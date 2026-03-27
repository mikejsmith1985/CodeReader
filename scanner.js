import { readdir, readFile, mkdir } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { join, extname, normalize, sep } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execFileAsync = promisify(execFile);

const PROJECTS_DIR = process.env.PROJECTS_DIR || join(tmpdir(), 'codereader-projects');

const IGNORE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', '.venv', 'venv', '.cache', 'coverage', '.devcontainer', '.github', '.claude', '.forge', 'cypress', 'logs', 'bin', 'test_release', 'dev-data', 'test-data']);
const IGNORE_EXTENSIONS = new Set(['.exe', '.dll', '.so', '.dylib', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.map', '.lock', '.db', '.sqlite', '.log', '.bak', '.old', '.zip', '.tar', '.gz']);

const LANGUAGE_MAP = {
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript',
  '.go': 'go',
  '.py': 'python',
  '.html': 'html', '.htm': 'html',
  '.css': 'css', '.scss': 'css',
  '.json': 'json',
  '.md': 'markdown',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.toml': 'toml',
  '.sh': 'bash', '.bash': 'bash', '.ps1': 'powershell',
  '.sql': 'sql',
  '.xml': 'xml',
};

function loadRepos() {
  try {
    return JSON.parse(readFileSync(join(__dirname, 'repos.json'), 'utf-8'));
  } catch {
    return [];
  }
}

async function cloneRepo(repo) {
  const targetDir = join(PROJECTS_DIR, repo.id);
  if (existsSync(targetDir)) {
    return targetDir;
  }

  await mkdir(PROJECTS_DIR, { recursive: true });

  let cloneUrl = repo.url;
  const token = process.env.GITHUB_CLONE_TOKEN;
  if (token && cloneUrl.startsWith('https://')) {
    cloneUrl = cloneUrl.replace('https://', `https://${token}@`);
  }

  console.log(`  📥 Cloning ${repo.id}...`);
  await execFileAsync('git', ['clone', '--depth', '1', cloneUrl, targetDir]);
  console.log(`  ✅ Cloned ${repo.id}`);
  return targetDir;
}

function detectLanguage(filePath) {
  return LANGUAGE_MAP[extname(filePath).toLowerCase()] || null;
}

async function countLines(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    return content.split('\n').length;
  } catch { return 0; }
}

async function buildFileTree(dirPath, depth = 0) {
  if (depth > 8) return [];

  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch { return []; }

  const result = [];

  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
    if (IGNORE_DIRS.has(entry.name)) continue;

    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const children = await buildFileTree(fullPath, depth + 1);
      if (children.length > 0) {
        result.push({ name: entry.name, path: fullPath, type: 'directory', children });
      }
    } else {
      const ext = extname(entry.name).toLowerCase();
      if (IGNORE_EXTENSIONS.has(ext)) continue;

      const language = detectLanguage(entry.name);
      if (!language && !['.env', '.gitignore', '.toml', 'Makefile', 'Dockerfile'].some(f => entry.name.includes(f))) continue;

      const lines = await countLines(fullPath);
      if (lines === 0) continue;

      result.push({ name: entry.name, path: fullPath, type: 'file', language: language || 'plaintext', lines });
    }
  }

  return result;
}

function countFilesAndLines(tree) {
  let files = 0, lines = 0;
  for (const node of tree) {
    if (node.type === 'file') { files++; lines += node.lines || 0; }
    else if (node.children) { const sub = countFilesAndLines(node.children); files += sub.files; lines += sub.lines; }
  }
  return { files, lines };
}

function detectProjectLanguage(tree) {
  const langCount = {};
  function walk(nodes) {
    for (const n of nodes) {
      if (n.type === 'file' && n.language) langCount[n.language] = (langCount[n.language] || 0) + (n.lines || 1);
      if (n.children) walk(n.children);
    }
  }
  walk(tree);
  const sorted = Object.entries(langCount).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : 'unknown';
}

function findStartFile(fileTree) {
  const candidates = [];
  function walk(nodes) {
    for (const n of nodes) {
      if (n.type === 'file') candidates.push(n);
      if (n.children) walk(n.children);
    }
  }
  walk(fileTree);

  const patterns = [
    /[/\\]src[/\\]App\.(jsx|tsx|js|ts)$/i,
    /[/\\]src[/\\]main\.(jsx|tsx|js|ts)$/i,
    /[/\\]src[/\\]index\.(jsx|tsx|js|ts)$/i,
    /[/\\]app\.(py|js|ts|jsx|tsx)$/i,
    /[/\\]main\.(py|go|js|ts)$/i,
    /[/\\]index\.(html|js|ts)$/i,
    /[/\\]server\.(js|ts|py)$/i,
  ];

  for (const pattern of patterns) {
    const match = candidates.find(f => pattern.test(f.path));
    if (match) return match;
  }

  const codeFiles = candidates.filter(f => ['javascript', 'typescript', 'python', 'go', 'html'].includes(f.language));
  if (codeFiles.length > 0) { codeFiles.sort((a, b) => b.lines - a.lines); return codeFiles[0]; }
  return candidates[0] || null;
}

export async function scanProjects() {
  const repos = loadRepos();
  if (repos.length === 0) {
    console.warn('  ⚠️  repos.json is empty. Add GitHub repo entries to get started.');
    return [];
  }

  const projects = [];

  for (const repo of repos) {
    let projectPath;
    try {
      projectPath = await cloneRepo(repo);
    } catch (err) {
      console.error(`  ❌ Failed to clone ${repo.id}: ${err.message}`);
      continue;
    }

    const fileTree = await buildFileTree(projectPath);
    const { files, lines } = countFilesAndLines(fileTree);
    if (files === 0) continue;

    const language = detectProjectLanguage(fileTree);

    // Resolve the recommended starting file (repos.json uses forward slashes)
    let startFile = null;
    const startWhy = repo.startWhy || 'This is the main file where the app begins — the best place to start';

    if (repo.startFile) {
      const platformStartFile = repo.startFile.split('/').join(sep);
      const fullStartPath = normalize(join(projectPath, platformStartFile));
      function findInTree(nodes) {
        for (const n of nodes) {
          if (n.type === 'file' && normalize(n.path) === fullStartPath) return n;
          if (n.children) { const r = findInTree(n.children); if (r) return r; }
        }
        return null;
      }
      startFile = findInTree(fileTree);
    }
    if (!startFile) startFile = findStartFile(fileTree);

    projects.push({
      id: repo.id,
      name: repo.name || repo.id,
      path: projectPath,
      language,
      filesCount: files,
      linesCount: lines,
      complexity: repo.complexity || 'medium',
      description: repo.description || 'A GitHub project',
      icon: repo.icon || '📁',
      order: repo.order ?? 99,
      fileTree,
      startFile: startFile
        ? { path: startFile.path, name: startFile.name, language: startFile.language, lines: startFile.lines, why: startWhy }
        : null,
    });
  }

  projects.sort((a, b) => a.order - b.order);
  return projects;
}

export async function getFileContent(filePath) {
  // Security: only allow files under PROJECTS_DIR
  const normalizedPath = normalize(filePath);
  const normalizedProjectsDir = normalize(PROJECTS_DIR);
  if (!normalizedPath.startsWith(normalizedProjectsDir + sep) && normalizedPath !== normalizedProjectsDir) {
    throw new Error('Access denied: file must be under the projects directory');
  }

  const content = await readFile(normalizedPath, 'utf-8');
  const language = detectLanguage(normalizedPath) || 'plaintext';
  const lines = content.split('\n').length;
  return { content, language, lines, path: normalizedPath };
}

export function parseCodeBlocks(content, language) {
  const lines = content.split('\n');
  const blocks = [];
  let currentBlock = [];
  let currentStart = 0;
  let braceDepth = 0;
  let inBlock = false;
  
  // Simple block detection based on language patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detect function/class/block starts
    const isBlockStart = (
      /^(export\s+)?(async\s+)?function\s+/.test(trimmed) ||
      /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/.test(trimmed) ||
      /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?(\([^)]*\))?\s*=>/.test(trimmed) ||
      /^(export\s+)?class\s+/.test(trimmed) ||
      /^(export\s+)?default\s+/.test(trimmed) ||
      /^def\s+/.test(trimmed) ||
      /^class\s+/.test(trimmed) ||
      /^func\s+/.test(trimmed) ||
      /^type\s+\w+\s+struct/.test(trimmed) ||
      /^(app|router)\.(get|post|put|delete|use)\(/.test(trimmed)
    );
    
    if (isBlockStart && currentBlock.length > 0) {
      blocks.push({
        code: currentBlock.join('\n'),
        startLine: currentStart,
        endLine: i - 1,
      });
      currentBlock = [];
      currentStart = i;
    }
    
    if (isBlockStart) {
      inBlock = true;
      currentStart = i;
    }
    
    currentBlock.push(line);
  }
  
  // Push remaining
  if (currentBlock.length > 0) {
    blocks.push({
      code: currentBlock.join('\n'),
      startLine: currentStart,
      endLine: lines.length - 1,
    });
  }
  
  // If no blocks detected (e.g., HTML/CSS), chunk by ~30 lines
  if (blocks.length <= 1 && lines.length > 40) {
    const chunked = [];
    for (let i = 0; i < lines.length; i += 30) {
      const chunk = lines.slice(i, Math.min(i + 30, lines.length));
      chunked.push({
        code: chunk.join('\n'),
        startLine: i,
        endLine: Math.min(i + 30, lines.length) - 1,
      });
    }
    return chunked;
  }
  
  return blocks;
}
