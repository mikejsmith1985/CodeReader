import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { scanProjects, getFileContent, parseCodeBlocks } from './scanner.js';
import { getExplanation, generateQuiz, generateGoals, validateGoalAnswer, isAIConfigured, clearTokenCache, getToken } from './ai-client.js';
import {
  getProgress, addXP, markComplete, recordQuizScore,
  getAchievements, unlockAchievement, visitProject,
  getVisitedProjects, getCompletionStats, getCompletionsForProject,
  completeGoal, getCompletedGoals, getSetting, setSetting,
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Cache scanned projects in memory
let projectsCache = null;

// --- API Routes ---

// Get all projects
app.get('/api/projects', async (req, res) => {
  try {
    if (!projectsCache) {
      projectsCache = await scanProjects();
    }
    // Return projects without full file trees (lighter payload)
    const projects = projectsCache.map(p => ({
      id: p.id,
      name: p.name,
      path: p.path,
      language: p.language,
      filesCount: p.filesCount,
      linesCount: p.linesCount,
      complexity: p.complexity,
      description: p.description,
      icon: p.icon,
      order: p.order,
      startFile: p.startFile || null,
    }));
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get file tree for a project
app.get('/api/projects/:id/files', async (req, res) => {
  try {
    if (!projectsCache) projectsCache = await scanProjects();
    const project = projectsCache.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    // Track visit
    visitProject(project.id);
    
    // Get completions for this project
    const completions = getCompletionsForProject(project.path);
    
    res.json({ files: project.fileTree, completions, startFile: project.startFile || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get file content
app.get('/api/files', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path parameter required' });
    
    const file = await getFileContent(filePath);
    const blocks = parseCodeBlocks(file.content, file.language);
    
    res.json({ ...file, blocks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI status check
app.get('/api/ai-status', async (req, res) => {
  const configured = isAIConfigured();
  if (!configured) {
    return res.json({ 
      status: 'not_configured',
      message: 'No GitHub token found. Set CODEREADER_GITHUB_TOKEN in .env file.',
      setupUrl: 'https://github.com/settings/tokens',
    });
  }
  // Quick test call
  try {
    const testResult = await getExplanation('__test__', 'const x = 1;', 1, -1, 'test', 'test');
    if (testResult.noAI) {
      return res.json({
        status: 'token_invalid',
        message: 'Token found but GitHub Models API rejected it. You need a PAT with models:read scope.',
        setupUrl: 'https://github.com/settings/tokens',
      });
    }
    return res.json({ status: 'working', message: 'AI is connected and working!' });
  } catch {
    return res.json({ status: 'error', message: 'Token found but API call failed.' });
  }
});

// Setup wizard: test and save token
app.post('/api/setup-token', async (req, res) => {
  const { token, action } = req.body;
  if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

  if (action === 'test') {
    try {
      const testResponse = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a friendly coding teacher. Respond in 1-2 sentences.' },
            { role: 'user', content: 'In plain English, what does "const x = 5;" do in JavaScript?' },
          ],
          temperature: 0.7,
          max_tokens: 150,
        }),
      });

      if (!testResponse.ok) {
        let hint = 'The token was rejected by GitHub Models.';
        if (testResponse.status === 401) {
          hint = 'Bad credentials — make sure you copied the full token and it has "Models: Read-only" permission.';
        } else if (testResponse.status === 403) {
          hint = 'Access denied — you may need to visit github.com/marketplace/models and click "Get started" first.';
        }
        return res.json({ success: false, message: hint });
      }

      const data = await testResponse.json();
      const sample = data.choices?.[0]?.message?.content || '';
      return res.json({ success: true, message: 'Token works! AI is ready to explain your code.', sample });
    } catch (err) {
      return res.json({ success: false, message: 'Connection error: ' + err.message });
    }
  }

  if (action === 'save') {
    try {
      // Save to SQLite DB — survives server restarts, no Vite file-watcher race condition
      setSetting('github_token', token.trim());
      // Also inject into the live process so AI works immediately without restart
      process.env.CODEREADER_GITHUB_TOKEN = token.trim();
      clearTokenCache();
      return res.json({ success: true, message: 'Token saved!' });
    } catch (err) {
      return res.json({ success: false, message: 'Failed to save token: ' + err.message });
    }
  }

  res.status(400).json({ success: false, message: 'Invalid action' });
});

// Chat with AI about the current file
app.post('/api/chat', async (req, res) => {
  try {
    const { question, code, filename, project, description, history } = req.body;
    if (!question) return res.status(400).json({ error: 'question required' });

    const token = getToken();
    if (!token) {
      return res.json({
        answer: 'AI is not set up yet.',
        action: 'setup',
        actionLabel: 'Set up free AI ⚙️',
      });
    }

    const codeSnippet = (code || '').slice(0, 6000);
    const systemPrompt = `You are a friendly, patient coding teacher helping a complete beginner understand code. 
The student is looking at a file called "${filename || 'unknown'}" from the project "${project || 'unknown'}" which ${description || 'is a software project'}.

Here is the code they are looking at:
\`\`\`
${codeSnippet}
\`\`\`

Rules:
- Use plain English. Avoid jargon unless you immediately explain it.
- Use real-world analogies to explain concepts.
- Be encouraging and patient — the student is a beginner.
- Keep answers concise (2-5 sentences) unless more detail is clearly needed.
- If they ask about something not in the code, still try to help with a general explanation.`;

    // Build message history
    const messages = [{ role: 'system', content: systemPrompt }];
    for (const msg of (history || [])) {
      messages.push({ role: 'user', content: msg.question });
      messages.push({ role: 'assistant', content: msg.answer });
    }
    messages.push({ role: 'user', content: question });

    const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.7, max_tokens: 600 }),
    });

    if (!response.ok) {
      return res.json({
        answer: 'AI request failed — your token may have expired.',
        action: 'setup',
        actionLabel: 'Fix in Settings ⚙️',
      });
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || 'No response from AI.';
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get AI explanation
app.post('/api/explain', async (req, res) => {
  try {
    const { filePath, code, depth, blockIndex, project, description } = req.body;
    if (!filePath || !code || !depth) {
      return res.status(400).json({ error: 'filePath, code, and depth required' });
    }
    
    const result = await getExplanation(filePath, code, depth, blockIndex || -1, project || '', description || '');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate quiz
app.post('/api/quiz', async (req, res) => {
  try {
    const { filePath, code, explanation, depth, blockIndex } = req.body;
    if (!code) return res.status(400).json({ error: 'code required' });
    
    const result = await generateQuiz(filePath || '', code, explanation || '', depth || 3, blockIndex || -1);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate mini-goals (minion fights) for a file
app.post('/api/goals', async (req, res) => {
  try {
    const { filePath, code, depth, filename, lineCount } = req.body;
    if (!code) return res.status(400).json({ error: 'code required' });
    const goals = await generateGoals(filePath || '', code, depth || 1, filename || '', lineCount || 100);
    const completed = getCompletedGoals(filePath || '', depth || 1);
    // How many challenges must be cleared to unlock the Boss Fight
    const required = Math.max(2, Math.round(goals.length * 0.65));
    res.json({ goals, completed, required });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete a mini-goal (minion fight) — awards 5 XP
app.post('/api/goals/complete', (req, res) => {
  try {
    const { filePath, depth, goalIndex } = req.body;
    completeGoal(filePath, depth, goalIndex);
    const progress = addXP(5);
    const newAchievements = checkAchievements();
    res.json({ ...progress, xpGained: 5, newAchievements });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Validate a learner's written answer to a challenge (AI-graded)
app.post('/api/goals/validate', async (req, res) => {
  try {
    const { code, challenge, answer, filePath, depth, goalIndex } = req.body;
    if (!challenge || !answer) return res.status(400).json({ error: 'challenge and answer required' });
    const result = await validateGoalAnswer(code || '', challenge, answer);
    if (result.noAI) {
      return res.json(result); // no XP — token is broken
    }
    if (result.pass) {
      completeGoal(filePath, depth, goalIndex);
      const progress = addXP(5);
      const newAchievements = checkAchievements();
      return res.json({ ...result, xpGained: 5, progress, newAchievements });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get progress
app.get('/api/progress', (req, res) => {
  try {
    const progress = getProgress();
    res.json(progress);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark completion and add XP
app.post('/api/progress/complete', (req, res) => {
  try {
    const { filePath, depth, blockIndex, xpGained } = req.body;
    
    markComplete(filePath, depth, blockIndex || -1);
    const progress = addXP(xpGained || 2);
    
    // Check achievements
    const newAchievements = checkAchievements();
    
    res.json({ ...progress, newAchievements });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record quiz score
app.post('/api/progress/quiz', (req, res) => {
  try {
    const { filePath, correct, total } = req.body;
    recordQuizScore(filePath, correct, total);
    const percent = total > 0 ? (correct / total) * 100 : 0;
    const baseXP = correct * 10;
    const passBonus = percent >= 60 ? 25 : 0;
    const perfectBonus = percent === 100 ? 25 : 0;
    const xp = baseXP + passBonus + perfectBonus;
    const progress = addXP(xp);
    const newAchievements = checkAchievements();
    res.json({ ...progress, newAchievements, xpGained: xp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get achievements
app.get('/api/achievements', (req, res) => {
  try {
    const unlocked = getAchievements();
    const unlockedIds = new Set(unlocked.map(a => a.id));
    
    const all = ACHIEVEMENT_DEFS.map(a => ({
      ...a,
      unlocked: unlockedIds.has(a.id),
      unlockedAt: unlocked.find(u => u.id === a.id)?.unlocked_at || null,
    }));
    
    res.json({ achievements: all });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get daily challenge
app.get('/api/daily-challenge', async (req, res) => {
  try {
    if (!projectsCache) projectsCache = await scanProjects();
    
    // Pick a deterministic "random" file based on today's date
    const today = new Date().toISOString().split('T')[0];
    const seed = today.split('-').reduce((a, b) => a + parseInt(b), 0);
    
    // Collect all source files
    const allFiles = [];
    function collectFiles(tree, projectId) {
      for (const node of tree) {
        if (node.type === 'file' && node.lines > 5 && node.lines < 200) {
          allFiles.push({ ...node, projectId });
        }
        if (node.children) collectFiles(node.children, projectId);
      }
    }
    for (const p of projectsCache) {
      collectFiles(p.fileTree, p.id);
    }
    
    if (allFiles.length === 0) {
      return res.json({ challenge: null });
    }
    
    const file = allFiles[seed % allFiles.length];
    const project = projectsCache.find(p => p.id === file.projectId);
    
    res.json({
      challenge: {
        filePath: file.path,
        fileName: file.name,
        language: file.language,
        lines: file.lines,
        projectId: file.projectId,
        projectName: project?.name || file.projectId,
        projectIcon: project?.icon || '📁',
        projectDescription: project?.description || '',
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rescan projects
app.post('/api/scan', async (req, res) => {
  try {
    projectsCache = await scanProjects();
    res.json({ success: true, projectCount: projectsCache.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI status
app.get('/api/ai-status', (req, res) => {
  res.json({ configured: isAIConfigured() });
});

// --- Achievement Definitions ---
const ACHIEVEMENT_DEFS = [
  { id: 'first-blood', name: 'First Blood', icon: '🩸', description: 'Complete your first explanation' },
  { id: 'bookworm', name: 'Bookworm', icon: '📚', description: 'Read 10 explanations in one session' },
  { id: 'perfect-score', name: 'Perfect Score', icon: '🎯', description: 'Get 100% on a quiz' },
  { id: 'on-fire', name: 'On Fire', icon: '🔥', description: '3-day learning streak' },
  { id: 'architect', name: 'Architect', icon: '🏗️', description: 'Complete all Blueprint level for a project' },
  { id: 'deep-diver', name: 'Deep Diver', icon: '🔬', description: 'Complete Mastery level on any file' },
  { id: 'world-explorer', name: 'World Explorer', icon: '🌍', description: 'Visit all projects' },
  { id: 'centurion', name: 'Centurion', icon: '💯', description: '100 correct quiz answers' },
  { id: 'speed-reader', name: 'Speed Reader', icon: '⚡', description: '5 explanations in under 10 minutes' },
  { id: 'graduate', name: 'Graduate', icon: '🎓', description: 'Complete an entire project at all depths' },
];

function checkAchievements() {
  const stats = getCompletionStats();
  const progress = getProgress();
  const newlyUnlocked = [];
  
  // First Blood
  if (stats.totalExplanations >= 1) {
    if (unlockAchievement('first-blood')) newlyUnlocked.push(ACHIEVEMENT_DEFS.find(a => a.id === 'first-blood'));
  }
  
  // Bookworm
  if (stats.sessionExplanations >= 10) {
    if (unlockAchievement('bookworm')) newlyUnlocked.push(ACHIEVEMENT_DEFS.find(a => a.id === 'bookworm'));
  }
  
  // On Fire
  if (progress.streak_days >= 3) {
    if (unlockAchievement('on-fire')) newlyUnlocked.push(ACHIEVEMENT_DEFS.find(a => a.id === 'on-fire'));
  }
  
  // World Explorer
  if (stats.projectsVisited >= 8) {
    if (unlockAchievement('world-explorer')) newlyUnlocked.push(ACHIEVEMENT_DEFS.find(a => a.id === 'world-explorer'));
  }
  
  // Centurion
  if (stats.totalQuizCorrect >= 100) {
    if (unlockAchievement('centurion')) newlyUnlocked.push(ACHIEVEMENT_DEFS.find(a => a.id === 'centurion'));
  }
  
  // Speed Reader
  if (stats.sessionExplanations >= 5 && stats.sessionStart) {
    const elapsed = (Date.now() - new Date(stats.sessionStart).getTime()) / 60000;
    if (elapsed <= 10) {
      if (unlockAchievement('speed-reader')) newlyUnlocked.push(ACHIEVEMENT_DEFS.find(a => a.id === 'speed-reader'));
    }
  }
  
  return newlyUnlocked;
}

// --- Serve frontend in production ---
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('{*path}', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(join(distPath, 'index.html'));
    }
  });
}

const PORT = process.env.PORT || process.env.CODEREADER_PORT || 3420;
app.listen(PORT, () => {
  console.log(`\n  🧠 CodeReader running at http://localhost:${PORT}\n`);
  console.log(`  AI: ${isAIConfigured() ? '✅ GitHub Models configured' : '⚠️  Set GITHUB_TOKEN in .env for AI explanations'}\n`);
});
