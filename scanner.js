import { extname } from 'path';

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

function detectLanguage(filePath) {
  return LANGUAGE_MAP[extname(filePath).toLowerCase()] || null;
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
