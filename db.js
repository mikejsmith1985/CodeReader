import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Store } from 'express-session';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = process.env.DATA_DIR || __dirname;
const db = new Database(join(dataDir, 'codereader.db'));
db.pragma('journal_mode = WAL');

// Migration: if users table doesn't exist, we're on old schema — drop and recreate
const usersExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
if (!usersExists) {
  db.exec(`
    DROP TABLE IF EXISTS progress;
    DROP TABLE IF EXISTS completions;
    DROP TABLE IF EXISTS achievements;
    DROP TABLE IF EXISTS quiz_scores;
    DROP TABLE IF EXISTS goals_completed;
    DROP TABLE IF EXISTS project_visits;
    DROP TABLE IF EXISTS settings;
  `);
}

// Create all tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    github_id TEXT UNIQUE NOT NULL,
    username TEXT,
    avatar_url TEXT,
    access_token TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    data TEXT,
    expires INTEGER
  );

  CREATE TABLE IF NOT EXISTS user_repos (
    user_id INTEGER NOT NULL,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    added_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(user_id, owner, repo)
  );

  CREATE TABLE IF NOT EXISTS progress (
    user_id INTEGER PRIMARY KEY,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak_days INTEGER DEFAULT 0,
    last_active_date TEXT,
    total_explanations INTEGER DEFAULT 0,
    total_quizzes_correct INTEGER DEFAULT 0,
    session_explanations INTEGER DEFAULT 0,
    session_start TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS completions (
    user_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    depth INTEGER NOT NULL,
    block_index INTEGER DEFAULT -1,
    completed_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(user_id, file_path, depth, block_index),
    FOREIGN KEY(user_id) REFERENCES users(id)
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
    user_id INTEGER NOT NULL,
    id TEXT NOT NULL,
    unlocked_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(user_id, id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS quiz_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_path TEXT,
    correct INTEGER,
    total INTEGER,
    scored_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS project_visits (
    user_id INTEGER NOT NULL,
    project_id TEXT NOT NULL,
    visited_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(user_id, project_id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS goals_cache (
    file_path TEXT NOT NULL,
    depth INTEGER NOT NULL,
    goals_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(file_path, depth)
  );

  CREATE TABLE IF NOT EXISTS goals_completed (
    user_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    depth INTEGER NOT NULL,
    goal_index INTEGER NOT NULL,
    completed_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(user_id, file_path, depth, goal_index),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(user_id, key),
    FOREIGN KEY(user_id) REFERENCES users(id)
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

// --- User management ---

export function upsertUser(githubId, username, avatarUrl, accessToken) {
  const existing = db.prepare('SELECT * FROM users WHERE github_id = ?').get(String(githubId));
  if (existing) {
    db.prepare('UPDATE users SET username = ?, avatar_url = ?, access_token = ? WHERE github_id = ?')
      .run(username, avatarUrl, accessToken, String(githubId));
    return db.prepare('SELECT * FROM users WHERE github_id = ?').get(String(githubId));
  }
  db.prepare('INSERT INTO users (github_id, username, avatar_url, access_token) VALUES (?, ?, ?, ?)')
    .run(String(githubId), username, avatarUrl, accessToken);
  return db.prepare('SELECT * FROM users WHERE github_id = ?').get(String(githubId));
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function getUserRepos(userId) {
  return db.prepare('SELECT owner, repo, added_at FROM user_repos WHERE user_id = ?').all(userId);
}

export function addUserRepo(userId, owner, repo) {
  db.prepare('INSERT OR IGNORE INTO user_repos (user_id, owner, repo) VALUES (?, ?, ?)').run(userId, owner, repo);
}

export function removeUserRepo(userId, owner, repo) {
  db.prepare('DELETE FROM user_repos WHERE user_id = ? AND owner = ? AND repo = ?').run(userId, owner, repo);
}

// --- Progress ---

function ensureProgressRow(userId) {
  db.prepare('INSERT OR IGNORE INTO progress (user_id, xp) VALUES (?, 0)').run(userId);
}

export function getProgress(userId) {
  ensureProgressRow(userId);
  const row = db.prepare('SELECT * FROM progress WHERE user_id = ?').get(userId);
  const levelInfo = getLevelInfo(row.xp);

  // Update streak
  const today = new Date().toISOString().split('T')[0];
  if (row.last_active_date !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const newStreak = row.last_active_date === yesterday ? row.streak_days + 1 : 1;
    db.prepare('UPDATE progress SET streak_days = ?, last_active_date = ?, session_explanations = 0, session_start = ? WHERE user_id = ?')
      .run(newStreak, today, new Date().toISOString(), userId);
    row.streak_days = newStreak;
    row.last_active_date = today;
    row.session_explanations = 0;
  }

  const completions = db.prepare('SELECT file_path, depth, block_index FROM completions WHERE user_id = ?').all(userId);
  const completionMap = {};
  for (const c of completions) {
    completionMap[`${c.file_path}::${c.depth}::${c.block_index}`] = true;
  }

  return { ...row, ...levelInfo, completions: completionMap };
}

export function addXP(userId, amount) {
  ensureProgressRow(userId);
  db.prepare('UPDATE progress SET xp = xp + ? WHERE user_id = ?').run(amount, userId);
  const today = new Date().toISOString().split('T')[0];
  db.prepare('UPDATE progress SET last_active_date = ? WHERE user_id = ?').run(today, userId);
  return getProgress(userId);
}

export function markComplete(userId, filePath, depth, blockIndex = -1) {
  ensureProgressRow(userId);
  db.prepare('INSERT OR IGNORE INTO completions (user_id, file_path, depth, block_index) VALUES (?, ?, ?, ?)')
    .run(userId, filePath, depth, blockIndex);
  db.prepare('UPDATE progress SET total_explanations = total_explanations + 1, session_explanations = session_explanations + 1 WHERE user_id = ?').run(userId);
}

// --- Explanations cache (shared/global) ---

export function getCachedExplanation(filePath, depth, blockIndex = -1) {
  return db.prepare('SELECT explanation FROM explanations_cache WHERE file_path = ? AND depth = ? AND block_index = ?')
    .get(filePath, depth, blockIndex);
}

export function cacheExplanation(filePath, depth, blockIndex, explanation) {
  db.prepare('INSERT OR REPLACE INTO explanations_cache (file_path, depth, block_index, explanation) VALUES (?, ?, ?, ?)')
    .run(filePath, depth, blockIndex, explanation);
}

// --- Quiz cache (shared/global) ---

export function getCachedQuiz(filePath, depth, blockIndex = -1) {
  const row = db.prepare('SELECT questions_json FROM quiz_cache WHERE file_path = ? AND depth = ? AND block_index = ?')
    .get(filePath, depth, blockIndex);
  return row ? JSON.parse(row.questions_json) : null;
}

export function cacheQuiz(filePath, depth, blockIndex, questions) {
  db.prepare('INSERT OR REPLACE INTO quiz_cache (file_path, depth, block_index, questions_json) VALUES (?, ?, ?, ?)')
    .run(filePath, depth, blockIndex, JSON.stringify(questions));
}

// --- Quiz scores ---

export function recordQuizScore(userId, filePath, correct, total) {
  ensureProgressRow(userId);
  db.prepare('INSERT INTO quiz_scores (user_id, file_path, correct, total) VALUES (?, ?, ?, ?)').run(userId, filePath, correct, total);
  db.prepare('UPDATE progress SET total_quizzes_correct = total_quizzes_correct + ? WHERE user_id = ?').run(correct, userId);
}

// --- Achievements ---

export function getAchievements(userId) {
  return db.prepare('SELECT * FROM achievements WHERE user_id = ?').all(userId);
}

export function unlockAchievement(userId, id) {
  const existing = db.prepare('SELECT id FROM achievements WHERE user_id = ? AND id = ?').get(userId, id);
  if (existing) return false;
  db.prepare('INSERT INTO achievements (user_id, id) VALUES (?, ?)').run(userId, id);
  return true;
}

// --- Project visits ---

export function visitProject(userId, projectId) {
  db.prepare('INSERT OR IGNORE INTO project_visits (user_id, project_id) VALUES (?, ?)').run(userId, projectId);
}

export function getVisitedProjects(userId) {
  return db.prepare('SELECT project_id FROM project_visits WHERE user_id = ?').all(userId).map(r => r.project_id);
}

// --- Goals cache (shared/global) ---

export function getCachedGoals(filePath, depth) {
  const row = db.prepare('SELECT goals_json FROM goals_cache WHERE file_path = ? AND depth = ?').get(filePath, depth);
  return row ? JSON.parse(row.goals_json) : null;
}

export function cacheGoals(filePath, depth, goals) {
  db.prepare('INSERT OR REPLACE INTO goals_cache (file_path, depth, goals_json) VALUES (?, ?, ?)').run(filePath, depth, JSON.stringify(goals));
}

// --- Goals completed ---

export function completeGoal(userId, filePath, depth, goalIndex) {
  db.prepare('INSERT OR IGNORE INTO goals_completed (user_id, file_path, depth, goal_index) VALUES (?, ?, ?, ?)').run(userId, filePath, depth, goalIndex);
}

export function getCompletedGoals(userId, filePath, depth) {
  return db.prepare('SELECT goal_index FROM goals_completed WHERE user_id = ? AND file_path = ? AND depth = ?').all(userId, filePath, depth).map(r => r.goal_index);
}

// --- Settings (per-user) ---

export function getSetting(userId, key) {
  const row = db.prepare('SELECT value FROM settings WHERE user_id = ? AND key = ?').get(userId, key);
  return row ? row.value : null;
}

export function setSetting(userId, key, value) {
  db.prepare("INSERT OR REPLACE INTO settings (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))").run(userId, key, value);
}

// --- Stats ---

export function getCompletionStats(userId) {
  return {
    totalExplanations: db.prepare('SELECT COUNT(*) as c FROM completions WHERE user_id = ?').get(userId).c,
    totalQuizCorrect: db.prepare('SELECT COALESCE(SUM(correct), 0) as c FROM quiz_scores WHERE user_id = ?').get(userId).c,
    totalQuizzes: db.prepare('SELECT COUNT(*) as c FROM quiz_scores WHERE user_id = ?').get(userId).c,
    sessionExplanations: db.prepare('SELECT session_explanations FROM progress WHERE user_id = ?').get(userId)?.session_explanations || 0,
    sessionStart: db.prepare('SELECT session_start FROM progress WHERE user_id = ?').get(userId)?.session_start || null,
    projectsVisited: db.prepare('SELECT COUNT(*) as c FROM project_visits WHERE user_id = ?').get(userId).c,
  };
}

export function getCompletionsForProject(userId, owner, repo) {
  return db.prepare('SELECT file_path, depth FROM completions WHERE user_id = ? AND file_path LIKE ?').all(userId, `${owner}/${repo}/%`);
}

// --- SQLiteStore for express-session ---

export class SQLiteStore extends Store {
  get(sid, cb) {
    try {
      const row = db.prepare('SELECT data, expires FROM sessions WHERE sid = ?').get(sid);
      if (!row) return cb(null, null);
      if (row.expires && row.expires < Date.now()) {
        db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.data));
    } catch (e) { cb(e); }
  }

  set(sid, sessionData, cb) {
    try {
      const expires = sessionData.cookie?.expires
        ? new Date(sessionData.cookie.expires).getTime()
        : Date.now() + 86400000 * 7;
      db.prepare('INSERT OR REPLACE INTO sessions (sid, data, expires) VALUES (?, ?, ?)').run(sid, JSON.stringify(sessionData), expires);
      cb(null);
    } catch (e) { cb(e); }
  }

  destroy(sid, cb) {
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      cb(null);
    } catch (e) { cb(e); }
  }

  touch(sid, session, cb) {
    try {
      const expires = session.cookie?.expires
        ? new Date(session.cookie.expires).getTime()
        : Date.now() + 86400000 * 7;
      db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?').run(expires, sid);
      cb(null);
    } catch (e) { cb(e); }
  }
}

export default db;
