import { Octokit } from '@octokit/rest';
import { extname } from 'path';

const IGNORE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', '.venv', 'venv', '.cache', 'coverage', 'cypress', 'logs', 'bin']);
const IGNORE_EXTENSIONS = new Set(['.exe', '.dll', '.so', '.dylib', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.map', '.lock', '.db', '.sqlite', '.log', '.bak', '.old', '.zip', '.tar', '.gz']);

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

const INCLUDE_NAMES = new Set(['.env.example', 'Dockerfile', 'Makefile', '.gitignore']);

export function detectLanguage(filename) {
  const ext = extname(filename).toLowerCase();
  return LANGUAGE_MAP[ext] || null;
}

export function makeOctokit(token) {
  return token ? new Octokit({ auth: token }) : new Octokit();
}

export async function getUserRepos(token) {
  const octokit = makeOctokit(token);
  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    per_page: 100,
    sort: 'updated',
    affiliation: 'owner,collaborator',
  });
  return data.map(r => ({
    id: r.id,
    owner: r.owner.login,
    repo: r.name,
    description: r.description || '',
    language: r.language || '',
    stargazerCount: r.stargazers_count || 0,
    isPrivate: r.private,
    updatedAt: r.updated_at,
    url: r.html_url,
  }));
}

export async function searchRepos(query, token) {
  const octokit = makeOctokit(token);
  const { data } = await octokit.rest.search.repos({
    q: query,
    sort: 'stars',
    per_page: 20,
  });
  return data.items.map(r => ({
    id: r.id,
    owner: r.owner.login,
    repo: r.name,
    description: r.description || '',
    language: r.language || '',
    stargazerCount: r.stargazers_count || 0,
    isPrivate: r.private,
    updatedAt: r.updated_at,
    url: r.html_url,
  }));
}

export async function getRepoInfo(owner, repo, token) {
  const octokit = makeOctokit(token);
  const { data } = await octokit.rest.repos.get({ owner, repo });
  return {
    id: data.id,
    owner: data.owner.login,
    repo: data.name,
    description: data.description || '',
    language: data.language || '',
    stargazerCount: data.stargazers_count || 0,
    isPrivate: data.private,
    updatedAt: data.updated_at,
    url: data.html_url,
  };
}

export async function getRepoTree(owner, repo, token) {
  const octokit = makeOctokit(token);
  const { data } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: 'HEAD',
    recursive: '1',
  });

  // Build nested tree from flat paths
  const root = [];

  function shouldInclude(pathStr) {
    const parts = pathStr.split('/');
    for (const part of parts) {
      if (IGNORE_DIRS.has(part)) return false;
    }
    const filename = parts[parts.length - 1];
    if (INCLUDE_NAMES.has(filename)) return true;
    const ext = extname(filename).toLowerCase();
    if (IGNORE_EXTENSIONS.has(ext)) return false;
    return detectLanguage(filename) !== null;
  }

  function getOrCreateDir(parts, parentArr) {
    const name = parts[0];
    let node = parentArr.find(n => n.name === name && n.type === 'directory');
    if (!node) {
      node = { name, path: '', type: 'directory', children: [] };
      parentArr.push(node);
    }
    if (parts.length === 1) return node;
    return getOrCreateDir(parts.slice(1), node.children);
  }

  for (const item of data.tree) {
    if (item.type === 'blob') {
      if (!shouldInclude(item.path)) continue;
      const parts = item.path.split('/');
      const filename = parts[parts.length - 1];
      const language = detectLanguage(filename) || 'plaintext';
      const lines = item.size ? Math.ceil(item.size / 40) : 0;
      if (lines === 0) continue;

      const node = {
        name: filename,
        path: `${owner}/${repo}/${item.path}`,
        type: 'file',
        language,
        lines,
      };

      if (parts.length === 1) {
        root.push(node);
      } else {
        const dirParts = parts.slice(0, -1);
        const dir = getOrCreateDir(dirParts, root);
        dir.children.push(node);
      }
    }
  }

  // Sort: directories first, then alphabetical
  function sortTree(arr) {
    arr.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of arr) {
      if (node.children) sortTree(node.children);
    }
  }
  sortTree(root);
  return root;
}

export async function getFileContent(owner, repo, path, token) {
  const octokit = makeOctokit(token);
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path });
    if (data.size > 1024 * 1024) {
      throw new Error('File too large (>1MB)');
    }
    if (data.encoding !== 'base64') {
      throw new Error('Unexpected encoding: ' + data.encoding);
    }
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    const filename = path.split('/').pop();
    const language = detectLanguage(filename) || 'plaintext';
    const lines = content.split('\n').length;
    return { content, language, lines, path: `${owner}/${repo}/${path}` };
  } catch (err) {
    if (err.status === 403 && err.message?.includes('too large')) {
      throw new Error('File too large to fetch via API');
    }
    throw err;
  }
}
