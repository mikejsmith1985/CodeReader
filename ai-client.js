import { getCachedExplanation, cacheExplanation, getCachedQuiz, cacheQuiz, getCachedGoals, cacheGoals, getSetting } from './db.js';

const API_URL = 'https://models.inference.ai.azure.com/chat/completions';
const MODEL = 'gpt-4o-mini';

let cachedToken = null;

export function clearTokenCache() {
  cachedToken = null;
}

export function getToken() {
  if (cachedToken) return cachedToken;

  // 1. DB-stored token (set via setup wizard — most reliable, survives restarts)
  try {
    const dbToken = getSetting('github_token');
    if (dbToken) { cachedToken = dbToken; return dbToken; }
  } catch {}

  // 2. Explicit environment variables only
  const envToken = process.env.CODEREADER_GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN;
  if (envToken) { cachedToken = envToken; return envToken; }

  // Do NOT fall back to gh auth token or GH_TOKEN/GITHUB_TOKEN —
  // those are Copilot CLI / GitHub API tokens that are rejected by GitHub Models API.
  return null;
}

async function chatCompletion(messages, token) {
  const resolvedToken = token || getToken();
  if (!resolvedToken) {
    console.log('AI: No token found. Set CODEREADER_GITHUB_TOKEN in .env or run "gh auth login".');
    return null;
  }
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resolvedToken}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI API error ${response.status}: ${errText.slice(0, 200)}`);
      if (response.status === 401) {
        console.error('Token rejected. GitHub Models needs a PAT with "models:read" scope.');
        console.error('Create one at: https://github.com/settings/tokens');
        if (!token) cachedToken = null; // Only reset global cache if using global token
      }
      return null;
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('AI request failed:', err.message);
    return null;
  }
}

const DEPTH_PROMPTS = {
  1: (filename, project, description, code) => [
    { role: 'system', content: 'You are a friendly coding teacher explaining code to a complete beginner who has never programmed before. Use everyday language. Use analogies to real-world things. No jargon without explanation. Keep it short — 2-4 sentences max.' },
    { role: 'user', content: `This file is called "${filename}" from the project "${project}" which ${description}.\n\nSummarize what this file does in plain English:\n\n\`\`\`\n${code.slice(0, 4000)}\n\`\`\`` },
  ],
  2: (filename, project, description, code) => [
    { role: 'system', content: 'You are a friendly coding teacher. Break this file into its main sections/parts. For each part, give it a simple name and explain its role in 1-2 sentences. Use the analogy of rooms in a house — what is each room for? Use a numbered list. Keep explanations simple and jargon-free.' },
    { role: 'user', content: `File: "${filename}" from "${project}" (${description}).\n\nBreak this into sections and explain each:\n\n\`\`\`\n${code.slice(0, 6000)}\n\`\`\`` },
  ],
  3: (filename, project, description, code) => [
    { role: 'system', content: 'You are a friendly coding teacher explaining how a specific code block works to a beginner. Walk through the logic step by step in plain English. Use analogies. Explain what each important line does, but group them logically. Define programming terms when you first use them. Be encouraging.' },
    { role: 'user', content: `This code is from "${filename}" in "${project}" (${description}).\n\nExplain how this code works step by step:\n\n\`\`\`\n${code}\n\`\`\`` },
  ],
  4: (filename, project, description, code) => [
    { role: 'system', content: 'You are annotating code line-by-line for a learner. For every meaningful line (skip blank lines), provide a brief explanation of what it does and WHY it\'s there. Format as:\n`line N`: explanation\n\nHighlight any patterns, conventions, or clever tricks. Be thorough but concise per line.' },
    { role: 'user', content: `Annotate every line of this code from "${filename}" in "${project}" (${description}):\n\n\`\`\`\n${code}\n\`\`\`` },
  ],
};

function analyzeCode(code, filename) {
  const lines = code.split('\n');
  const lineCount = lines.length;
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // Detect language from extension
  const langMap = {
    js: 'JavaScript', jsx: 'React (JavaScript)', ts: 'TypeScript', tsx: 'React (TypeScript)',
    py: 'Python', go: 'Go', html: 'HTML', css: 'CSS', json: 'JSON', md: 'Markdown',
    yaml: 'YAML', yml: 'YAML', sh: 'Shell Script', bat: 'Batch Script',
  };
  const language = langMap[ext] || ext.toUpperCase();

  // Find imports/requires
  const imports = lines.filter(l => /^\s*(import |from |require\(|const .* = require)/.test(l));

  // Find function/method definitions
  const functions = [];
  for (const line of lines) {
    const match = line.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\(|(?:export\s+)?(?:default\s+)?function\s+(\w+)|def\s+(\w+)|func\s+(\w+)|(\w+)\s*:\s*(?:async\s+)?function)/);
    if (match) {
      const name = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
      if (name && !['if', 'for', 'while', 'switch', 'catch'].includes(name)) {
        functions.push(name);
      }
    }
  }

  // Find React components
  const components = lines.filter(l => /(?:function|const)\s+[A-Z]\w+/.test(l))
    .map(l => l.match(/(?:function|const)\s+([A-Z]\w+)/)?.[1]).filter(Boolean);

  // Find exports
  const exports = lines.filter(l => /^\s*export\s/.test(l));

  // Find comments
  const comments = lines.filter(l => /^\s*(\/\/|#|\/\*|\*)/.test(l));

  // Find JSX/HTML elements
  const htmlTags = new Set();
  for (const line of lines) {
    const matches = line.matchAll(/<(\w[\w-]*)/g);
    for (const m of matches) htmlTags.add(m[1]);
  }

  // Find state/hooks usage
  const hooks = lines.filter(l => /use[A-Z]\w+\(/.test(l))
    .map(l => l.match(/(use[A-Z]\w+)\(/)?.[1]).filter(Boolean);

  // Find CSS classes
  const cssClasses = lines.filter(l => /className[=:]/.test(l)).length;

  // Find API calls
  const apiCalls = lines.filter(l => /fetch\(|axios\.|\.get\(|\.post\(|\.put\(|\.delete\(|http\./.test(l));

  // Find conditionals and loops
  const conditionals = lines.filter(l => /\b(if|else|switch|case)\b/.test(l)).length;
  const loops = lines.filter(l => /\b(for|while|\.map\(|\.forEach\(|\.filter\(|range\()/.test(l)).length;

  return {
    lineCount, language, ext,
    imports, functions, components, exports, comments,
    htmlTags: [...htmlTags], hooks: [...new Set(hooks)],
    cssClasses, apiCalls, conditionals, loops,
  };
}

function generateFallback(depth, filename, code) {
  const a = analyzeCode(code, filename);

  if (depth === 1) {
    // Bird's Eye: What does this file do?
    let desc = `📄 "${filename}" is a ${a.language} file with ${a.lineCount} lines.\n\n`;

    if (a.components.length > 0) {
      desc += `🧩 It defines ${a.components.length === 1 ? 'a React component' : `${a.components.length} React components`}: ${a.components.join(', ')}.\n`;
      if (a.hooks.length > 0) {
        desc += `🪝 It uses React hooks: ${a.hooks.join(', ')} — these manage the component's data and behavior.\n`;
      }
    } else if (a.functions.length > 0) {
      desc += `⚙️ It contains ${a.functions.length} function${a.functions.length > 1 ? 's' : ''}: ${a.functions.slice(0, 8).join(', ')}${a.functions.length > 8 ? ` ...and ${a.functions.length - 8} more` : ''}.\n`;
    }

    if (a.imports.length > 0) {
      desc += `📦 It imports ${a.imports.length} thing${a.imports.length > 1 ? 's' : ''} from other files — these are tools and building blocks it needs.\n`;
    }

    if (a.apiCalls.length > 0) {
      desc += `🌐 It makes ${a.apiCalls.length} network call${a.apiCalls.length > 1 ? 's' : ''} — it talks to a server to get or send data.\n`;
    }

    if (a.htmlTags.length > 0 && a.ext !== 'css') {
      desc += `🎨 It creates visual elements like: ${a.htmlTags.slice(0, 10).join(', ')}.\n`;
    }

    if (a.exports.length > 0) {
      desc += `📤 It exports ${a.exports.length} thing${a.exports.length > 1 ? 's' : ''} — other files can use what this file creates.\n`;
    }

    desc += `\n💡 Think of this file as a ${a.components.length > 0 ? 'building block of the user interface' : a.apiCalls.length > 0 ? 'messenger that talks to other systems' : a.functions.length > 3 ? 'toolbox of useful actions' : 'piece of the puzzle'}.`;
    desc += `\n\n🔧 For richer AI explanations, set up your GitHub token — see the README for details.`;
    return desc;
  }

  if (depth === 2) {
    // Blueprint: How is it organized?
    let desc = `🗺️ Here's the structure of "${filename}":\n\n`;
    const sections = [];
    let sectionNum = 1;

    if (a.imports.length > 0) {
      const importNames = a.imports.slice(0, 5).map(l => {
        const m = l.match(/(?:import\s+(?:\{?\s*)?(\w+)|from\s+['"]([^'"]+)|require\(['"]([^'"]+))/);
        return m?.[2] || m?.[3] || m?.[1] || '?';
      });
      sections.push(`${sectionNum}. 📦 IMPORTS (top of file)\n   Bringing in tools from: ${importNames.join(', ')}${a.imports.length > 5 ? ` (+${a.imports.length - 5} more)` : ''}\n   Think of this like gathering ingredients before cooking.`);
      sectionNum++;
    }

    if (a.components.length > 0) {
      for (const comp of a.components.slice(0, 5)) {
        sections.push(`${sectionNum}. 🧩 COMPONENT: ${comp}\n   A React component — a reusable piece of the user interface.\n   Like a LEGO brick that shows something on screen.`);
        sectionNum++;
      }
    }

    if (a.functions.length > 0) {
      const nonComponentFns = a.functions.filter(f => !a.components.includes(f));
      if (nonComponentFns.length > 0) {
        for (const fn of nonComponentFns.slice(0, 6)) {
          sections.push(`${sectionNum}. ⚙️ FUNCTION: ${fn}\n   A reusable action — when called, it does a specific job.`);
          sectionNum++;
        }
      }
    }

    if (a.hooks.length > 0) {
      sections.push(`${sectionNum}. 🪝 HOOKS USED: ${a.hooks.join(', ')}\n   React hooks manage the "memory" and "reactions" of components.\n   Like the nervous system of the interface.`);
      sectionNum++;
    }

    if (a.exports.length > 0) {
      sections.push(`${sectionNum}. 📤 EXPORTS (bottom)\n   What this file shares with the rest of the app.\n   Like the output of a factory.`);
    }

    desc += sections.join('\n\n');
    desc += `\n\n🔧 For AI-powered explanations with more detail, set up your GitHub token.`;
    return desc;
  }

  if (depth === 3) {
    // Mechanics: How does this code work?
    let desc = `⚙️ Let's walk through this code step by step:\n\n`;
    const codeLines = code.split('\n').filter(l => l.trim());
    const steps = [];

    for (let i = 0; i < Math.min(codeLines.length, 20); i++) {
      const line = codeLines[i].trim();
      let explanation = '';

      if (/^import |^from |^require/.test(line)) explanation = '📦 Getting a tool from another file';
      else if (/^export /.test(line)) explanation = '📤 Making this available to other files';
      else if (/^const |^let |^var /.test(line)) explanation = '📝 Creating a variable (named storage)';
      else if (/^function |^def |^func /.test(line)) explanation = '⚙️ Defining a new function (reusable action)';
      else if (/^if |^else/.test(line)) explanation = '🔀 Making a decision (if this, then that)';
      else if (/^for |^while |\.map\(|\.forEach\(/.test(line)) explanation = '🔄 Repeating something for each item';
      else if (/^return /.test(line)) explanation = '📤 Sending back a result';
      else if (/fetch\(|axios/.test(line)) explanation = '🌐 Calling a server/API';
      else if (/\.filter\(/.test(line)) explanation = '🔍 Filtering a list (keeping only matches)';
      else if (/\.sort\(/.test(line)) explanation = '📊 Sorting items in order';
      else if (/useState/.test(line)) explanation = '🪝 Creating a piece of "memory" for the UI';
      else if (/useEffect/.test(line)) explanation = '🪝 Setting up an automatic reaction';
      else if (/console\.log/.test(line)) explanation = '🖨️ Printing a debug message';
      else if (/\{|\}/.test(line) && line.length < 3) continue; // skip bare braces
      else if (/^\s*\/\//.test(line)) explanation = '💬 Developer note (comment)';
      else explanation = '📋 Code logic';

      if (explanation) steps.push(`  ${explanation}\n  \`${line.length > 60 ? line.slice(0, 60) + '...' : line}\``);
    }

    desc += steps.join('\n\n');
    if (codeLines.length > 20) desc += `\n\n  ... and ${codeLines.length - 20} more lines`;
    desc += `\n\n🔧 AI mode gives richer, context-aware explanations. Set up your GitHub token for the full experience.`;
    return desc;
  }

  // depth 4
  let desc = `🔬 Line-by-line breakdown of "${filename}":\n\n`;
  const codeLines = code.split('\n');
  for (let i = 0; i < Math.min(codeLines.length, 30); i++) {
    const line = codeLines[i];
    if (!line.trim()) continue;
    desc += `Line ${i + 1}: \`${line.trim().slice(0, 50)}\`\n`;
  }
  desc += `\n🔧 Full AI-powered line-by-line annotation requires your GitHub token. Set it up for detailed explanations.`;
  return desc;
}

export async function getExplanation(filePath, code, depth, blockIndex, project, description, token) {
  // Check cache first
  const cached = getCachedExplanation(filePath, depth, blockIndex);
  if (cached) return { explanation: cached.explanation, fromCache: true };
  
  const filename = filePath.split(/[/\\]/).pop();
  const messages = DEPTH_PROMPTS[depth]?.(filename, project, description, code);
  
  if (!messages) return { explanation: 'Invalid depth level.', fromCache: false };
  
  const result = await chatCompletion(messages, token);
  
  if (result) {
    cacheExplanation(filePath, depth, blockIndex, result);
    return { explanation: result, fromCache: false };
  }
  
  return { explanation: generateFallback(depth, filename, code), fromCache: false, noAI: true };
}

export async function generateQuiz(filePath, code, explanation, depth, blockIndex, token) {
  // Check cache
  const cached = getCachedQuiz(filePath, depth, blockIndex);
  if (cached) return { questions: cached, fromCache: true };
  
  const resolvedToken = token || getToken();
  if (!resolvedToken) {
    return { questions: generateFallbackQuiz(code), fromCache: false, noAI: true };
  }
  
  const messages = [
    { role: 'system', content: `Generate exactly 3 multiple-choice questions to test comprehension of the following code.

FOCUS ONLY on:
- What this code DOES in the real application (its purpose and effect on the user)
- WHY certain patterns or approaches were chosen (design reasoning)
- What WOULD HAPPEN if something changed (cause and effect thinking)
- Concepts explained in the explanation the learner already read

NEVER ask about:
- Specific literal values: hex color codes, magic numbers, pixel values, URLs, string constants. NEVER ask "what is the value of X" or "what color does #1a1a2e produce" — these test memorization of trivia, not understanding.
- Counting lines, blank lines, characters, imports, or anything numerical
- Memorizing exact line numbers or syntax details
- Punctuation, semicolons, brackets, or formatting
- Things not clearly explained in the explanation provided
- Any question whose correct answer is a raw value copied from the code (like "#1a1a2e", "42", "localhost:3000")

If the code block is mostly variable/constant declarations (like CSS custom properties or config objects), ask about the PURPOSE of those variables — why they exist, what happens if you change them, why this pattern is used — not what their specific values are.

Questions must be answerable by someone who understood the explanation — no memorization of raw values needed.

IMPORTANT — question wording rules:
- Each question MUST include the exact variable name, function name, or keyword from the code that it is asking about (e.g. use "state variable 'constraints'" not just "the variable", use "useState" not just "the hook")
- Each question MUST have a "codeExcerpt" field: copy the 1–4 most relevant lines from the code that the question refers to, exactly as written. This anchors the learner to the right part of the code.
- Make each question fully self-contained — the learner should be able to read the question + excerpt and know exactly what is being asked without hunting through the full file.

Return ONLY a valid JSON array, no markdown, no text outside the JSON:
[{"question": "...", "codeExcerpt": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct": 0, "hint": "..."}]

Where "correct" is the 0-based index of the correct answer.` },
    { role: 'user', content: `Code:\n\`\`\`\n${code}\n\`\`\`\n\nExplanation the learner already read:\n${explanation || '(No explanation available — focus on what the code does conceptually.)'}` },
  ];
  
  const result = await chatCompletion(messages, resolvedToken);
  
  if (result) {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = result;
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      
      const questions = JSON.parse(jsonStr);
      if (Array.isArray(questions) && questions.length > 0) {
        cacheQuiz(filePath, depth, blockIndex, questions);
        return { questions, fromCache: false };
      }
    } catch (e) {
      console.error('Failed to parse quiz JSON:', e.message);
    }
  }
  
  return { questions: generateFallbackQuiz(code), fromCache: false, noAI: true };
}

function generateFallbackQuiz(code) {
  const isReact = code.includes('return (') || code.includes('useState') || code.includes('useEffect') || /<[A-Z]/.test(code);
  const hasImports = code.split('\n').some(l => l.trim().startsWith('import'));
  const hasFetch = code.includes('fetch(') || code.includes('axios');
  const hasFilter = code.includes('.filter(') || code.includes('.map(') || code.includes('.reduce(');

  if (isReact) {
    return [{
      question: "In React, what does the 'return' statement inside a component define?",
      options: ['A) The data the component stores in memory', 'B) The visual output — the HTML that appears on screen', 'C) The functions the component can call', 'D) How fast the component loads'],
      correct: 1,
      hint: 'Think about what you actually see on the screen when this component is used.',
    }];
  }
  if (hasFetch) {
    return [{
      question: "When code uses 'fetch()', what is it doing?",
      options: ['A) Saving data to the user\'s hard drive', 'B) Asking another server for data over the internet', 'C) Creating a new variable', 'D) Showing something on screen'],
      correct: 1,
      hint: 'Think about where the data could be coming from.',
    }];
  }
  if (hasFilter) {
    return [{
      question: "What does an array method like '.filter()' or '.map()' do to a list of items?",
      options: ['A) Sorts them alphabetically', 'B) Deletes all items from the list', 'C) Processes each item to create a new list or pick matching items', 'D) Sends the list to a server'],
      correct: 2,
      hint: 'Think of it like running every item through a test or transformation.',
    }];
  }
  if (hasImports) {
    return [{
      question: "Why do files start with 'import' statements?",
      options: ['A) To make the file run faster', 'B) To bring in tools and code written in other files', 'C) To tell the browser what language the file uses', 'D) To create variables for the rest of the file'],
      correct: 1,
      hint: 'Think about sharing tools between different files in a project.',
    }];
  }
  return [{
    question: "Why do developers break code into separate functions instead of writing everything in one place?",
    options: ['A) To make the code run faster', 'B) To use less memory', 'C) To organize tasks so each function has one clear job', 'D) To hide the code from other developers'],
    correct: 2,
    hint: 'Think about readability and organization — like chapters in a book.',
  }];
}

export function isAIConfigured() {
  return !!getToken();
}

function goalsCountForLines(lineCount) {
  return Math.min(6, Math.max(2, Math.ceil(lineCount / 50)));
}

export async function generateGoals(filePath, code, depth, filename, lineCount = 100, token) {
  const numGoals = goalsCountForLines(lineCount);

  const cached = getCachedGoals(filePath, depth);
  // Invalidate cache if it has fewer goals than we now need (file got bigger or ratio changed)
  if (cached && cached.length >= numGoals) return cached;

  const resolvedToken = token || getToken();
  if (!resolvedToken) return generateFallbackGoals(code, filename, numGoals);

  const codePreview = code.slice(0, 4000);
  const messages = [
    { role: 'system', content: `You are a coding instructor. Generate exactly ${numGoals} CODE READING CHALLENGES for a beginner looking at the provided code.

Each challenge must:
- Target a SPECIFIC, CONCRETE piece of logic in the actual code (name real variables, real conditions, real functions you see)
- Require the learner to READ and UNDERSTAND — not just locate a word
- Be answerable by reading the code carefully
- Teach something real about how code works

CHALLENGE TYPES to use — spread across different types for coverage:
- DATA FLOW: "Find where [specific variable] is set. What value does it start as, and what changes it?"
- CONDITIONS: "There is an if-statement that controls [specific behavior]. What has to be TRUE for [X outcome] to happen?"
- CAUSE & EFFECT: "If the condition on the [specific check] were always false, what would the user see instead?"
- WHAT GETS RETURNED: "Find the return statement in [specific function]. Describe in your own words what it sends back."
- STATE CHANGE: "Look at how [specific state variable] is updated. What triggers the change and what does it change to?"
- PURPOSE: "Look at [specific block]. What real-world problem is this code solving for the user?"

NEVER generate:
- "Find the function name and guess what it does"
- "Find the import lines"
- "Look at the filename"
- Anything involving counting lines, characters, or occurrences
- Vague "find X" with no understanding required

Spread the challenges across DIFFERENT parts of the code so the learner has to read broadly, not just one section.
Each challenge should take 1-3 minutes of real reading — not 5 seconds of scanning.

IMPORTANT — each challenge MUST include a "codeExcerpt" field: copy the 1–4 most relevant lines from the code that the challenge refers to, exactly as written. This anchors the learner to exactly the right part of the code so they are not searching blind.

Return ONLY valid JSON array with exactly ${numGoals} items:
[{"challenge": "...", "codeExcerpt": "...", "hint": "...", "emoji": "🎯"}, ...]

Use different emojis: 🎯 🔬 🧠 💡 🔄 ⚡ 🌊 🗝️ 🏗️ 🎭` },
    { role: 'user', content: `Filename: ${filename}\nDepth level: ${depth} (${depth <= 2 ? 'big-picture overview' : 'mechanics / how it works'})\nFile length: ${lineCount} lines\n\nCode:\n\`\`\`\n${codePreview}\n\`\`\`` },
  ];

  const result = await chatCompletion(messages, resolvedToken);
  if (result) {
    try {
      let jsonStr = result;
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      const goals = JSON.parse(jsonStr);
      if (Array.isArray(goals) && goals.length > 0) {
        const trimmed = goals.slice(0, numGoals);
        cacheGoals(filePath, depth, trimmed);
        return trimmed;
      }
    } catch (e) {
      console.error('Failed to parse goals JSON:', e.message);
    }
  }
  return generateFallbackGoals(code, filename, numGoals);
}

function generateFallbackGoals(code, filename, numGoals = 3) {
  const hasIf = code.includes('if (') || code.includes('if(');
  const hasReturn = code.includes('return ');
  const hasFetch = code.includes('fetch(') || code.includes('axios');
  const hasState = code.includes('useState');
  const hasMap = code.includes('.map(') || code.includes('.filter(');
  const hasAsync = code.includes('async ') || code.includes('await ');
  const hasProp = code.includes('props.') || code.includes('{ ');

  const pool = [];
  if (hasState) pool.push({ challenge: 'Find a useState call in the code. What data is being tracked, and what is its starting value?', hint: 'Look for useState(...) — the value inside the parentheses is the starting value', emoji: '🔄' });
  if (hasIf)    pool.push({ challenge: 'Find an if-statement in the code. In your own words, what decision is the code making, and what happens in each case?', hint: 'Look for "if (" — read the condition inside the parentheses and the code in the {} after it', emoji: '🧠' });
  if (hasReturn) pool.push({ challenge: 'Find a return statement. What does this piece of code give back when it finishes running?', hint: 'Look for the word "return" — describe what follows it in plain English', emoji: '🎯' });
  if (hasFetch) pool.push({ challenge: 'This code fetches data from somewhere. Where does it go to get the data, and what does it do with the result?', hint: 'Look for fetch(...) — the URL tells you where, and the .then() or await shows what happens next', emoji: '🌊' });
  if (hasMap)   pool.push({ challenge: 'Find a .map() or .filter() call. What list is it operating on, and what does each item in the result look like?', hint: 'Look for .map( or .filter( — the code inside the parentheses transforms or filters each item', emoji: '🔬' });
  if (hasAsync) pool.push({ challenge: 'Find an async function or await keyword. What is the code waiting for, and what happens after it finishes waiting?', hint: 'Look for "await" — the code pauses there until something completes. What completes?', emoji: '⏳' });
  if (hasProp)  pool.push({ challenge: 'Find where data is being passed into or used from outside this section. What information does this code depend on that it did not create itself?', hint: 'Look for props, parameters in function arguments, or values that appear without being defined nearby', emoji: '🗝️' });

  // Always have a general purpose question as final fallback
  pool.push({ challenge: 'Read through the code and describe in your own words what you think the overall job of this section is. What problem does it solve for the user?', hint: 'Look at what the code does from top to bottom — what does it produce or enable?', emoji: '💡' });
  pool.push({ challenge: 'Find a variable that changes value during the code\'s execution. What starts it off, and what event or condition causes it to change?', hint: 'Look for = assignments after the initial declaration — something has to trigger each change', emoji: '⚡' });

  while (pool.length < numGoals) {
    pool.push({ challenge: 'Look at any function defined in this code. What does it do when called, and what information does it need to do its job?', hint: 'Functions have a name, some inputs (parameters), and a body — read all three parts', emoji: '🏗️' });
  }
  return pool.slice(0, numGoals);
}

export async function validateGoalAnswer(code, challenge, answer, token) {
  const resolvedToken = token || getToken();
  if (!resolvedToken) {
    return {
      pass: false,
      noAI: true,
      feedback: "AI is needed to check your answers. Set up your free token in ⚙️ Settings.",
    };
  }

  const messages = [
    { role: 'system', content: `You are a kind, encouraging coding instructor validating a beginner's understanding of code.

The learner was asked a challenge question about the code. Grade their written answer:
- PASS: They demonstrate they understood the core concept, even if imprecise or in plain English
- FAIL: They guessed, wrote too little, or missed the key idea

Respond with ONLY valid JSON:
{"pass": true/false, "feedback": "1-2 encouraging sentences. If pass, explain why they're right. If fail, give a SPECIFIC hint pointing them at exactly what to look at in the code — no shame, just redirect."}

Be lenient. Plain English understanding counts. Perfect technical terms are NOT required.` },
    { role: 'user', content: `Code:\n\`\`\`\n${code.slice(0, 3000)}\n\`\`\`\n\nChallenge asked:\n${challenge}\n\nLearner's answer:\n${answer}` },
  ];

  try {
    const result = await chatCompletion(messages, resolvedToken);
    if (result) {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed.pass === 'boolean') return parsed;
      }
    }
  } catch (e) {
    console.error('Validation error:', e.message);
  }
  // AI call failed (expired/invalid token) — do NOT award XP
  return {
    pass: false,
    noAI: true,
    feedback: "AI validation isn't available right now — your token may have expired. Fix it in ⚙️ Settings, then try again.",
  };
}
