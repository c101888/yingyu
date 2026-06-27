// 会员等级体系配置
// free: 免费用户，3 次/月场景生成（按月恢复，不累计）
// plus: 升级用户，90 次/月，每日路线最多 3 条
// pro: 高级用户，150 次/月，每日路线最多 5 条，丰富对话细节 + 积分兑换奖励

export type Tier = 'free' | 'plus' | 'pro';

export interface TierConfig {
  tier: Tier;
  nameZh: string;
  nameEn: string;
  badge: string;
  color: string;
  // 场景生成次数限制
  monthlyGenLimit: number; // 0 表示无月限制
  totalGenLimit: number; // 0 表示无终身限制（free=6 终身）
  // 每日路线数量限制（含预置 2 条）
  maxRoutes: number;
  // 功能权限
  canEnrichDialogue: boolean; // 丰富对话细节
  canRedeemRewards: boolean; // 积分兑换奖励
  canEditRoutes: boolean; // 编辑每日路线
  canCreateRoutes: boolean; // 新建每日路线
  // 价格（分）
  priceMonthly: number;
  priceYearly: number;
  // 权益列表
  benefits: string[];
}

export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  free: {
    tier: 'free',
    nameZh: '免费版',
    nameEn: 'Free',
    badge: '🆓',
    color: 'text-gray-600',
    monthlyGenLimit: 3,
    totalGenLimit: 0,
    maxRoutes: 2,
    canEnrichDialogue: false,
    canRedeemRewards: false,
    canEditRoutes: false,
    canCreateRoutes: false,
    priceMonthly: 0,
    priceYearly: 0,
    benefits: [
      '场景生成 3 次/月（按月恢复，不累计）',
      '每日路线 2 条预置（上学日 + 周末）',
      '完整学习闭环（学习 + 测验 + 演练）',
      '积分与等级系统',
      '听示范跟读',
    ],
  },
  plus: {
    tier: 'plus',
    nameZh: 'Plus 版',
    nameEn: 'Plus',
    badge: '⭐',
    color: 'text-blue-600',
    monthlyGenLimit: 90,
    totalGenLimit: 0,
    maxRoutes: 3,
    canEnrichDialogue: false,
    canRedeemRewards: false,
    canEditRoutes: true,
    canCreateRoutes: true,
    priceMonthly: 1900, // ¥19
    priceYearly: 16800, // ¥168（约 ¥14/月，26% off）
    benefits: [
      '场景生成 90 次/月（约每天 3 次）',
      '每日路线最多 3 条（含预置 2 条）',
      '可编辑预置路线 + 新建自定义路线',
      '完整学习闭环 + 语音评分',
      '场景缓存复用（相同输入秒出）',
      '无广告体验',
    ],
  },
  pro: {
    tier: 'pro',
    nameZh: 'Pro 版',
    nameEn: 'Pro',
    badge: '👑',
    color: 'text-purple-600',
    monthlyGenLimit: 150,
    totalGenLimit: 0,
    maxRoutes: 5,
    canEnrichDialogue: true,
    canRedeemRewards: true,
    canEditRoutes: true,
    canCreateRoutes: true,
    priceMonthly: 3900, // ¥39
    priceYearly: 34800, // ¥348（约 ¥29/月，26% off）
    benefits: [
      '包含 Plus 全部权益',
      '场景生成 150 次/月（约每天 5 次）',
      '每日路线最多 5 条（含预置 2 条）',
      '丰富对话细节（AI 重新生成对话，可自定义场景细节）',
      '积分兑换奖励（星星换礼物，家长自定义奖励）',
      '优先体验新功能',
    ],
  },
};

export const TIER_ORDER: Tier[] = ['free', 'plus', 'pro'];

// 获取当前月份标识（如 "2026-06"）
export function getCurrentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 格式化价格（分 → 元）
export function formatPrice(cents: number): string {
  if (cents === 0) return '免费';
  return `¥${(cents / 100).toFixed(0)}`;
}

// 计算年费月均价格
export function yearlyPerMonth(cents: number): string {
  return `¥${(cents / 100 / 12).toFixed(1)}`;
}

// 预设奖励模板（Pro 用户首次访问时种入）
export const PRESET_REWARDS: Array<{
  name: string;
  description: string;
  starCost: number;
  icon: string;
}> = [
  { name: '看一集动画片', description: '今天可以看一集喜欢的动画片（约 20 分钟）', starCost: 30, icon: '📺' },
  { name: '选今晚的晚餐', description: '今晚吃什么由你决定', starCost: 50, icon: '🍽️' },
  { name: '周末多玩 30 分钟', description: '周末游戏时间额外增加 30 分钟', starCost: 80, icon: '🎮' },
  { name: '去公园玩', description: '周末全家去公园游玩', starCost: 100, icon: '🌳' },
  { name: '选一个小玩具', description: '可以挑选一个小玩具（预算内）', starCost: 150, icon: '🧸' },
  { name: '睡前多听一个故事', description: '今晚睡前多听一个故事', starCost: 20, icon: '📖' },
];
