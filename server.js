import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import session from 'express-session';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { parseCodeBlocks } from './scanner.js';
import { getExplanation, generateQuiz, generateGoals, validateGoalAnswer, isAIConfigured, clearTokenCache, getToken } from './ai-client.js';
import {
  upsertUser, getUserById,
  getUserRepos as dbGetUserRepos, addUserRepo, removeUserRepo,
  getProgress, addXP, markComplete, recordQuizScore,
  getAchievements, unlockAchievement, visitProject,
  getVisitedProjects, getCompletionStats, getCompletionsForProject,
  completeGoal, getCompletedGoals, getSetting, setSetting,
  SQLiteStore,
} from './db.js';
import { getUserRepos, searchRepos, getRepoInfo, getRepoTree, getFileContent as ghGetFileContent } from './github-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Session + Passport setup ---
app.use(session({
  store: new SQLiteStore(),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.GITHUB_CALLBACK_URL || 'https://codereader.fly.dev/auth/github/callback',
  scope: ['user:email', 'repo'],
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const user = upsertUser(profile.id, profile.username, profile.photos?.[0]?.value, accessToken);
    done(null, user);
  } catch (err) { done(err); }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  try { done(null, getUserById(id)); } catch (e) { done(e); }
});

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function getAIToken(req) {
  if (req.user) {
    const userToken = getSetting(req.user.id, 'github_token');
    if (userToken) return userToken;
    if (req.user.access_token) return req.user.access_token;
  }
  return process.env.CODEREADER_GITHUB_TOKEN || null;
}

// --- Auth routes ---
app.get('/auth/github', passport.authenticate('github'));
app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/?error=auth' }),
  (req, res) => res.redirect('/')
);
app.post('/auth/logout', (req, res) => {
  req.logout(() => res.json({ success: true }));
});
app.get('/api/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: { id: req.user.id, username: req.user.username, avatarUrl: req.user.avatar_url } });
});

// --- Repo management endpoints ---

app.get('/api/repos', requireAuth, async (req, res) => {
  try {
    const rows = dbGetUserRepos(req.user.id);
    const enriched = await Promise.allSettled(
      rows.map(async ({ owner, repo, added_at }) => {
        try {
          const info = await getRepoInfo(owner, repo, req.user.access_token);
          return { ...info, added_at };
        } catch {
          return { owner, repo, added_at, description: '', language: '', stargazerCount: 0, isPrivate: false };
        }
      })
    );
    res.json({ repos: enriched.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/repos/search', requireAuth, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q) {
      const results = await getUserRepos(req.user.access_token);
      return res.json({ results });
    }
    const results = await searchRepos(q, req.user.access_token);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/repos/add', requireAuth, async (req, res) => {
  try {
    const { owner, repo } = req.body;
    if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });
    addUserRepo(req.user.id, owner, repo);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/repos/:owner/:repo', requireAuth, async (req, res) => {
  try {
    removeUserRepo(req.user.id, req.params.owner, req.params.repo);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/repos/:owner/:repo/files', requireAuth, async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const tree = await getRepoTree(owner, repo, req.user.access_token);
    const completions = getCompletionsForProject(req.user.id, owner, repo);
    visitProject(req.user.id, `${owner}/${repo}`);

    // Auto-detect start file
    let startFile = null;
    const patterns = [
      /src\/App\.(jsx|tsx|js|ts)$/i,
      /src\/main\.(jsx|tsx|js|ts)$/i,
      /src\/index\.(jsx|tsx|js|ts)$/i,
      /app\.(py|js|ts|jsx|tsx)$/i,
      /main\.(py|go|js|ts)$/i,
      /index\.(html|js|ts)$/i,
      /server\.(js|ts|py)$/i,
    ];
    function findStart(nodes) {
      for (const n of nodes) {
        if (n.type === 'file') {
          for (const p of patterns) {
            if (p.test(n.path)) return n;
          }
        }
        if (n.children) { const f = findStart(n.children); if (f) return f; }
      }
      return null;
    }
    startFile = findStart(tree);
    if (!startFile) {
      // Fall back to largest code file
      const allFiles = [];
      function collect(nodes) {
        for (const n of nodes) {
          if (n.type === 'file' && ['javascript', 'typescript', 'python', 'go'].includes(n.language)) allFiles.push(n);
          if (n.children) collect(n.children);
        }
      }
      collect(tree);
      allFiles.sort((a, b) => b.lines - a.lines);
      startFile = allFiles[0] || null;
    }

    res.json({ files: tree, completions, startFile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get file content
app.get('/api/files', requireAuth, async (req, res) => {
  try {
    const { owner, repo, path } = req.query;
    if (!owner || !repo || !path) return res.status(400).json({ error: 'owner, repo, and path required' });

    const file = await ghGetFileContent(owner, repo, path, req.user.access_token);
    const blocks = parseCodeBlocks(file.content, file.language);

    res.json({ ...file, blocks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI status check
app.get('/api/ai-status', async (req, res) => {
  const token = getAIToken(req);
  if (!token) {
    return res.json({
      status: 'not_configured',
      message: 'No GitHub token found. Set CODEREADER_GITHUB_TOKEN in .env file.',
      setupUrl: 'https://github.com/settings/tokens',
    });
  }
  try {
    const testResult = await getExplanation('__test__', 'const x = 1;', 1, -1, 'test', 'test', token);
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
app.post('/api/setup-token', requireAuth, async (req, res) => {
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
      setSetting(req.user.id, 'github_token', token.trim());
      clearTokenCache();
      return res.json({ success: true, message: 'Token saved!' });
    } catch (err) {
      return res.json({ success: false, message: 'Failed to save token: ' + err.message });
    }
  }

  res.status(400).json({ success: false, message: 'Invalid action' });
});

// Chat with AI about the current file
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { question, code, filename, project, description, history } = req.body;
    if (!question) return res.status(400).json({ error: 'question required' });

    const token = getAIToken(req);
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
app.post('/api/explain', requireAuth, async (req, res) => {
  try {
    const { filePath, code, depth, blockIndex, project, description } = req.body;
    if (!filePath || !code || !depth) {
      return res.status(400).json({ error: 'filePath, code, and depth required' });
    }

    const token = getAIToken(req);
    const result = await getExplanation(filePath, code, depth, blockIndex || -1, project || '', description || '', token);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate quiz
app.post('/api/quiz', requireAuth, async (req, res) => {
  try {
    const { filePath, code, explanation, depth, blockIndex } = req.body;
    if (!code) return res.status(400).json({ error: 'code required' });

    const token = getAIToken(req);
    const result = await generateQuiz(filePath || '', code, explanation || '', depth || 3, blockIndex || -1, token);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate mini-goals
app.post('/api/goals', requireAuth, async (req, res) => {
  try {
    const { filePath, code, depth, filename, lineCount } = req.body;
    if (!code) return res.status(400).json({ error: 'code required' });

    const token = getAIToken(req);
    const goals = await generateGoals(filePath || '', code, depth || 1, filename || '', lineCount || 100, token);
    const completed = getCompletedGoals(req.user.id, filePath || '', depth || 1);
    const required = Math.max(2, Math.round(goals.length * 0.65));
    res.json({ goals, completed, required });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete a mini-goal
app.post('/api/goals/complete', requireAuth, (req, res) => {
  try {
    const { filePath, depth, goalIndex } = req.body;
    completeGoal(req.user.id, filePath, depth, goalIndex);
    const progress = addXP(req.user.id, 5);
    const newAchievements = checkAchievements(req.user.id);
    res.json({ ...progress, xpGained: 5, newAchievements });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Validate a learner's answer (AI-graded)
app.post('/api/goals/validate', requireAuth, async (req, res) => {
  try {
    const { code, challenge, answer, filePath, depth, goalIndex } = req.body;
    if (!challenge || !answer) return res.status(400).json({ error: 'challenge and answer required' });

    const token = getAIToken(req);
    const result = await validateGoalAnswer(code || '', challenge, answer, token);
    if (result.noAI) {
      return res.json(result);
    }
    if (result.pass) {
      completeGoal(req.user.id, filePath, depth, goalIndex);
      const progress = addXP(req.user.id, 5);
      const newAchievements = checkAchievements(req.user.id);
      return res.json({ ...result, xpGained: 5, progress, newAchievements });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get progress
app.get('/api/progress', requireAuth, (req, res) => {
  try {
    const progress = getProgress(req.user.id);
    res.json(progress);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark completion and add XP
app.post('/api/progress/complete', requireAuth, (req, res) => {
  try {
    const { filePath, depth, blockIndex, xpGained } = req.body;
    markComplete(req.user.id, filePath, depth, blockIndex || -1);
    const progress = addXP(req.user.id, xpGained || 2);
    const newAchievements = checkAchievements(req.user.id);
    res.json({ ...progress, newAchievements });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record quiz score
app.post('/api/progress/quiz', requireAuth, (req, res) => {
  try {
    const { filePath, correct, total } = req.body;
    recordQuizScore(req.user.id, filePath, correct, total);
    const percent = total > 0 ? (correct / total) * 100 : 0;
    const baseXP = correct * 10;
    const passBonus = percent >= 60 ? 25 : 0;
    const perfectBonus = percent === 100 ? 25 : 0;
    const xp = baseXP + passBonus + perfectBonus;
    const progress = addXP(req.user.id, xp);
    const newAchievements = checkAchievements(req.user.id);
    res.json({ ...progress, newAchievements, xpGained: xp });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get achievements
app.get('/api/achievements', requireAuth, (req, res) => {
  try {
    const unlocked = getAchievements(req.user.id);
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
app.get('/api/daily-challenge', requireAuth, async (req, res) => {
  try {
    const userRepos = dbGetUserRepos(req.user.id);
    if (userRepos.length === 0) {
      return res.json({ challenge: null });
    }

    const today = new Date().toISOString().split('T')[0];
    const seed = today.split('-').reduce((a, b) => a + parseInt(b), 0);

    // Collect files from user's repos via GitHub API
    const allFiles = [];
    for (const { owner, repo } of userRepos.slice(0, 5)) {
      try {
        const tree = await getRepoTree(owner, repo, req.user.access_token);
        function collectFiles(nodes) {
          for (const n of nodes) {
            if (n.type === 'file' && n.lines > 5 && n.lines < 200) {
              allFiles.push({ ...n, owner, repo });
            }
            if (n.children) collectFiles(n.children);
          }
        }
        collectFiles(tree);
      } catch { /* skip repos that fail */ }
    }

    if (allFiles.length === 0) {
      return res.json({ challenge: null });
    }

    const file = allFiles[seed % allFiles.length];

    res.json({
      challenge: {
        filePath: file.path,
        fileName: file.name,
        language: file.language,
        lines: file.lines,
        owner: file.owner,
        repo: file.repo,
        projectName: `${file.owner}/${file.repo}`,
        projectIcon: '📁',
        projectDescription: '',
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

function checkAchievements(userId) {
  const stats = getCompletionStats(userId);
  const progress = getProgress(userId);
  const newlyUnlocked = [];

  if (stats.totalExplanations >= 1) {
    if (unlockAchievement(userId, 'first-blood')) newlyUnlocked.push(ACHIEVEMENT_DEFS.find(a => a.id === 'first-blood'));
  }
  if (stats.sessionExplanations >= 10) {
    if (unlockAchievement(userId, 'bookworm')) newlyUnlocked.push(ACHIEVEMENT_DEFS.find(a => a.id === 'bookworm'));
  }
  if (progress.streak_days >= 3) {
    if (unlockAchievement(userId, 'on-fire')) newlyUnlocked.push(ACHIEVEMENT_DEFS.find(a => a.id === 'on-fire'));
  }
  if (stats.projectsVisited >= 8) {
    if (unlockAchievement(userId, 'world-explorer')) newlyUnlocked.push(ACHIEVEMENT_DEFS.find(a => a.id === 'world-explorer'));
  }
  if (stats.totalQuizCorrect >= 100) {
    if (unlockAchievement(userId, 'centurion')) newlyUnlocked.push(ACHIEVEMENT_DEFS.find(a => a.id === 'centurion'));
  }
  if (stats.sessionExplanations >= 5 && stats.sessionStart) {
    const elapsed = (Date.now() - new Date(stats.sessionStart).getTime()) / 60000;
    if (elapsed <= 10) {
      if (unlockAchievement(userId, 'speed-reader')) newlyUnlocked.push(ACHIEVEMENT_DEFS.find(a => a.id === 'speed-reader'));
    }
  }

  return newlyUnlocked;
}

// --- Serve frontend in production ---
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('{*path}', (req, res) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/auth/')) {
      res.sendFile(join(distPath, 'index.html'));
    }
  });
}

const PORT = process.env.PORT || process.env.CODEREADER_PORT || 3420;
app.listen(PORT, () => {
  console.log(`\n  🧠 CodeReader running at http://localhost:${PORT}\n`);
  console.log(`  Auth: GitHub OAuth ${process.env.GITHUB_CLIENT_ID ? '✅ configured' : '⚠️  GITHUB_CLIENT_ID not set'}\n`);
});
