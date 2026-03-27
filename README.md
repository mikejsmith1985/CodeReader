# 🧠 CodeReader

**Duolingo for YOUR code** — a gamified, AI-powered app that teaches you to read and understand every line of code in your projects.

## Quick Start

```bash
cd C:\ProjectsWin\CodeReader
npm start
```

Then open **http://localhost:5420** in your browser.

## Setup AI Explanations (Optional but Recommended)

1. Get a free GitHub token at https://github.com/settings/tokens (no special scopes needed)
2. Create a `.env` file:
   ```
   GITHUB_TOKEN=ghp_your_token_here
   ```
3. Restart the app — AI explanations are now powered by GitHub Models (free tier)

The app works without AI too — you just won't get the rich explanations.

## How It Works

### 4 Depth Levels
| Level | Name | What You Learn |
|-------|------|---------------|
| 🦅 1 | Bird's Eye | "What does this file do?" — 2-3 sentence summary |
| 🗺️ 2 | Blueprint | "How is it organized?" — section-by-section breakdown |
| ⚙️ 3 | Mechanics | "How does this function work?" — block-by-block logic |
| 🔬 4 | Mastery | "What does every line do?" — line-by-line annotation |

### Gamification
- **XP System**: Earn XP for reading explanations (+10) and quiz answers (+25)
- **5 Levels**: Apprentice → Reader → Analyst → Architect → Master
- **10 Achievements**: Unlock badges like 🩸 First Blood, 🔥 On Fire, 🎓 Graduate
- **Daily Challenges**: One 2-minute task per day to keep your streak alive
- **Smart Learning Path**: Projects ordered from simplest to most complex

### Your Projects (sorted by difficulty)
1. 🔤 word-puzzle-solver (Simple)
2. 📱 mbl2pc (Simple)
3. 🚗 sync (Medium)
4. 🧰 ToolBox (Medium)
5. 📋 jira-html-parser (Medium)
6. 🔀 migrationtool (Medium)
7. 🖥️ forge-terminal (Complex)
8. 🔄 jira-automation (Complex)

## Tech Stack
- **Frontend**: React 19 + Vite + highlight.js
- **Backend**: Express + better-sqlite3
- **AI**: GitHub Models API (GPT-4o-mini, free tier)
