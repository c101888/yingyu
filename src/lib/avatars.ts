// 用户头像库：注册时可选择，未来可扩展为上传头像
// 使用 emoji 作为头像，轻量、跨平台、适合 App/平板

export const AVATAR_LIST: string[] = [
  // 动物系列（可爱友好，适合儿童教育产品）
  '🦊', '🐻', '🐼', '🐨', '🐰', '🐯', '🦁', '🐮',
  '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦄', '🐶',
  // 食物系列
  '🍎', '🍓', '🍌', '🍉', '🍇', '🥕', '🌽', '🍔',
  // 自然系列
  '🌟', '🌙', '☀️', '🌈', '🌸', '🍀', '🌳', '⚡',
];

// 默认头像（注册时未选择则随机分配一个）
export const DEFAULT_AVATAR = '🦊';

// 随机获取一个头像
export function getRandomAvatar(): string {
  return AVATAR_LIST[Math.floor(Math.random() * AVATAR_LIST.length)];
}

// 校验头像是否在头像库中（防止前端传入非法值）
export function isValidAvatar(avatar: string): boolean {
  return AVATAR_LIST.includes(avatar);
}
