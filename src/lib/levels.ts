// 等级系统：10 级表 + 称号 + 勋章 emoji + 所需星数
// 随着星数增长，等级提升，解锁更高称号和勋章

export interface Level {
  level: number; // 等级 1-10
  title: string; // 称号
  badge: string; // 勋章 emoji
  minStars: number; // 达到该等级所需最低星数
  color: string; // 等级主题色（Tailwind 类名片段）
}

// 10 级等级表：从「英语小芽」到「英语大师」
export const LEVELS: Level[] = [
  { level: 1, title: '英语小芽', badge: '🌱', minStars: 0, color: 'text-green-600' },
  { level: 2, title: '英语小苗', badge: '🌿', minStars: 30, color: 'text-green-600' },
  { level: 3, title: '英语小花', badge: '🌸', minStars: 80, color: 'text-pink-600' },
  { level: 4, title: '英语小树', badge: '🌳', minStars: 150, color: 'text-emerald-600' },
  { level: 5, title: '英语小达人', badge: '⭐', minStars: 250, color: 'text-amber-600' },
  { level: 6, title: '英语小能手', badge: '🌟', minStars: 400, color: 'text-amber-600' },
  { level: 7, title: '英语小专家', badge: '🏆', minStars: 600, color: 'text-yellow-600' },
  { level: 8, title: '英语小明星', badge: '🎖️', minStars: 850, color: 'text-purple-600' },
  { level: 9, title: '英语小导师', badge: '👑', minStars: 1150, color: 'text-purple-600' },
  { level: 10, title: '英语大师', badge: '💎', minStars: 1500, color: 'text-blue-600' },
];

// 根据总星数计算当前等级
export function getLevelByStars(totalStars: number): Level {
  let current = LEVELS[0];
  for (const lv of LEVELS) {
    if (totalStars >= lv.minStars) {
      current = lv;
    } else {
      break;
    }
  }
  return current;
}

// 获取下一个等级（若已满级返回 null）
export function getNextLevel(currentLevel: number): Level | null {
  const idx = LEVELS.findIndex((l) => l.level === currentLevel);
  if (idx < 0 || idx >= LEVELS.length - 1) return null;
  return LEVELS[idx + 1];
}

// 距离下一级还需多少星（若已满级返回 0）
export function starsToNextLevel(totalStars: number): number {
  const current = getLevelByStars(totalStars);
  const next = getNextLevel(current.level);
  if (!next) return 0;
  return next.minStars - totalStars;
}

// 当前等级进度百分比（0-100）
export function levelProgress(totalStars: number): number {
  const current = getLevelByStars(totalStars);
  const next = getNextLevel(current.level);
  if (!next) return 100; // 已满级
  const span = next.minStars - current.minStars;
  const gained = totalStars - current.minStars;
  return Math.min(100, Math.round((gained / span) * 100));
}
