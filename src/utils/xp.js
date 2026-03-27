export const LEVELS = [
  { level: 1, name: 'Apprentice', minXP: 0, color: '#8b949e' },
  { level: 2, name: 'Reader', minXP: 1000, color: '#3fb950' },
  { level: 3, name: 'Analyst', minXP: 2500, color: '#58a6ff' },
  { level: 4, name: 'Architect', minXP: 5000, color: '#bc8cff' },
  { level: 5, name: 'Master', minXP: 10000, color: '#d29922' },
]

export const DEPTH_NAMES = {
  1: { name: "Bird's Eye", icon: '🦅', color: '#3fb950', description: 'What does this file do?' },
  2: { name: 'Blueprint', icon: '🗺️', color: '#58a6ff', description: 'How is it organized?' },
  3: { name: 'Mechanics', icon: '⚙️', color: '#bc8cff', description: 'How does this code work?' },
  4: { name: 'Mastery', icon: '🔬', color: '#d29922', description: 'What does every line do?' },
}

export const COMPLEXITY_COLORS = {
  simple: '#3fb950',
  medium: '#d29922',
  complex: '#f85149',
}

export function getXPProgress(xp) {
  let current = LEVELS[0]
  for (const l of LEVELS) {
    if (xp >= l.minXP) current = l
  }
  const next = LEVELS.find(l => l.minXP > xp)
  if (!next) return { percent: 100, current, next: null }
  const inLevel = xp - current.minXP
  const needed = next.minXP - current.minXP
  return { percent: Math.floor((inLevel / needed) * 100), current, next }
}
