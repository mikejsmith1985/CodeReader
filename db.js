import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = process.env.DATA_DIR || __dirname;
const db = new Database(join(dataDir, 'codereader.db'));
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak_days INTEGER DEFAULT 0,
    last_active_date TEXT,
    total_explanations INTEGER DEFAULT 0,
    total_quizzes_correct INTEGER DEFAULT 0,
    session_explanations INTEGER DEFAULT 0,
    session_start TEXT
  );
  INSERT OR IGNORE INTO progress (id, xp) VALUES (1, 0);
  
  CREATE TABLE IF NOT EXISTS completions (
    file_path TEXT NOT NULL,
    depth INTEGER NOT NULL,
    block_index INTEGER DEFAULT -1,
    completed_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(file_path, depth, block_index)
  );
  
  CREATE TABLE IF NOT EXISTS explanations_cache (
    file_path TEXT NOT NULL,
    depth INTEGER NOT NULL,
    block_index INTEGER DEFAULT -1,
    explanation TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(file_path, depth, block_index)
  );
  
  CREATE TABLE IF NOT EXISTS quiz_cache (
    file_path TEXT NOT NULL,
    depth INTEGER NOT NULL,
    block_index INTEGER DEFAULT -1,
    questions_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(file_path, depth, block_index)
  );
  
  CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    unlocked_at TEXT DEFAULT (datetime('now'))
  );
  
  CREATE TABLE IF NOT EXISTS quiz_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT,
    correct INTEGER,
    total INTEGER,
    scored_at TEXT DEFAULT (datetime('now'))
  );
  
  CREATE TABLE IF NOT EXISTS project_visits (
    project_id TEXT PRIMARY KEY,
    visited_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS goals_cache (
    file_path TEXT NOT NULL,
    depth INTEGER NOT NULL,
    goals_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(file_path, depth)
  );

  CREATE TABLE IF NOT EXISTS goals_completed (
    file_path TEXT NOT NULL,
    depth INTEGER NOT NULL,
    goal_index INTEGER NOT NULL,
    completed_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(file_path, depth, goal_index)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Level thresholds
const LEVELS = [
  { level: 1, name: 'Apprentice', minXP: 0 },
  { level: 2, name: 'Reader', minXP: 1000 },
  { level: 3, name: 'Analyst', minXP: 2500 },
  { level: 4, name: 'Architect', minXP: 5000 },
  { level: 5, name: 'Master', minXP: 10000 },
];

function getLevelInfo(xp) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.minXP) current = l;
  }
  const next = LEVELS.find(l => l.minXP > xp);
  return {
    level: current.level,
    levelName: current.name,
    xpForNext: next ? next.minXP : null,
    xpInLevel: xp - current.minXP,
    xpNeeded: next ? next.minXP - current.minXP : 0,
  };
}

export function getProgress() {
  const row = db.prepare('SELECT * FROM progress WHERE id = 1').get();
  const levelInfo = getLevelInfo(row.xp);
  
  // Update streak
  const today = new Date().toISOString().split('T')[0];
  if (row.last_active_date !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const newStreak = row.last_active_date === yesterday ? row.streak_days + 1 : 1;
    db.prepare('UPDATE progress SET streak_days = ?, last_active_date = ?, session_explanations = 0, session_start = ? WHERE id = 1')
      .run(newStreak, today, new Date().toISOString());
    row.streak_days = newStreak;
    row.last_active_date = today;
    row.session_explanations = 0;
  }
  
  const completions = db.prepare('SELECT file_path, depth, block_index FROM completions').all();
  const completionMap = {};
  for (const c of completions) {
    completionMap[`${c.file_path}::${c.depth}::${c.block_index}`] = true;
  }
  
  return { ...row, ...levelInfo, completions: completionMap };
}

export function addXP(amount) {
  db.prepare('UPDATE progress SET xp = xp + ? WHERE id = 1').run(amount);
  const today = new Date().toISOString().split('T')[0];
  db.prepare('UPDATE progress SET last_active_date = ? WHERE id = 1').run(today);
  return getProgress();
}

export function markComplete(filePath, depth, blockIndex = -1) {
  db.prepare('INSERT OR IGNORE INTO completions (file_path, depth, block_index) VALUES (?, ?, ?)')
    .run(filePath, depth, blockIndex);
  db.prepare('UPDATE progress SET total_explanations = total_explanations + 1, session_explanations = session_explanations + 1 WHERE id = 1').run();
}

export function getCachedExplanation(filePath, depth, blockIndex = -1) {
  return db.prepare('SELECT explanation FROM explanations_cache WHERE file_path = ? AND depth = ? AND block_index = ?')
    .get(filePath, depth, blockIndex);
}

export function cacheExplanation(filePath, depth, blockIndex, explanation) {
  db.prepare('INSERT OR REPLACE INTO explanations_cache (file_path, depth, block_index, explanation) VALUES (?, ?, ?, ?)')
    .run(filePath, depth, blockIndex, explanation);
}

export function getCachedQuiz(filePath, depth, blockIndex = -1) {
  const row = db.prepare('SELECT questions_json FROM quiz_cache WHERE file_path = ? AND depth = ? AND block_index = ?')
    .get(filePath, depth, blockIndex);
  return row ? JSON.parse(row.questions_json) : null;
}

export function cacheQuiz(filePath, depth, blockIndex, questions) {
  db.prepare('INSERT OR REPLACE INTO quiz_cache (file_path, depth, block_index, questions_json) VALUES (?, ?, ?, ?)')
    .run(filePath, depth, blockIndex, JSON.stringify(questions));
}

export function recordQuizScore(filePath, correct, total) {
  db.prepare('INSERT INTO quiz_scores (file_path, correct, total) VALUES (?, ?, ?)').run(filePath, correct, total);
  db.prepare('UPDATE progress SET total_quizzes_correct = total_quizzes_correct + ? WHERE id = 1').run(correct);
}

export function getAchievements() {
  return db.prepare('SELECT * FROM achievements').all();
}

export function unlockAchievement(id) {
  const existing = db.prepare('SELECT id FROM achievements WHERE id = ?').get(id);
  if (existing) return false;
  db.prepare('INSERT INTO achievements (id) VALUES (?)').run(id);
  return true;
}

export function visitProject(projectId) {
  db.prepare('INSERT OR IGNORE INTO project_visits (project_id) VALUES (?)').run(projectId);
}

export function getVisitedProjects() {
  return db.prepare('SELECT project_id FROM project_visits').all().map(r => r.project_id);
}

export function getCachedGoals(filePath, depth) {
  const row = db.prepare('SELECT goals_json FROM goals_cache WHERE file_path = ? AND depth = ?').get(filePath, depth);
  return row ? JSON.parse(row.goals_json) : null;
}

export function cacheGoals(filePath, depth, goals) {
  db.prepare('INSERT OR REPLACE INTO goals_cache (file_path, depth, goals_json) VALUES (?, ?, ?)').run(filePath, depth, JSON.stringify(goals));
}

export function completeGoal(filePath, depth, goalIndex) {
  db.prepare('INSERT OR IGNORE INTO goals_completed (file_path, depth, goal_index) VALUES (?, ?, ?)').run(filePath, depth, goalIndex);
}

export function getCompletedGoals(filePath, depth) {
  return db.prepare('SELECT goal_index FROM goals_completed WHERE file_path = ? AND depth = ?').all(filePath, depth).map(r => r.goal_index);
}

export function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))').run(key, value);
}

export function getCompletionStats() {
  return {
    totalExplanations: db.prepare('SELECT COUNT(*) as c FROM completions').get().c,
    totalQuizCorrect: db.prepare('SELECT COALESCE(SUM(correct), 0) as c FROM quiz_scores').get().c,
    totalQuizzes: db.prepare('SELECT COUNT(*) as c FROM quiz_scores').get().c,
    sessionExplanations: db.prepare('SELECT session_explanations FROM progress WHERE id = 1').get().session_explanations,
    sessionStart: db.prepare('SELECT session_start FROM progress WHERE id = 1').get().session_start,
    projectsVisited: db.prepare('SELECT COUNT(*) as c FROM project_visits').get().c,
  };
}

export function getCompletionsForProject(projectPathPrefix) {
  return db.prepare('SELECT file_path, depth FROM completions WHERE file_path LIKE ?').all(projectPathPrefix + '%');
}

export default db;
