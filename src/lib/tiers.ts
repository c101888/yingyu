// 前端会员等级配置（与后端 server/src/config/tiers.ts 保持一致）

export type Tier = 'free' | 'plus' | 'pro';

export interface TierConfig {
  tier: Tier;
  nameZh: string;
  nameEn: string;
  badge: string;
  color: string;
  gradient: string;
  monthlyGenLimit: number;
  totalGenLimit: number;
  maxRoutes: number;
  canEnrichDialogue: boolean;
  canRedeemRewards: boolean;
  canEditRoutes: boolean;
  canCreateRoutes: boolean;
  priceMonthly: number;
  priceYearly: number;
  benefits: string[];
  highlight?: boolean;
}

export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  free: {
    tier: 'free',
    nameZh: '免费版',
    nameEn: 'Free',
    badge: '🆓',
    color: 'text-gray-600',
    gradient: 'from-gray-50 to-gray-100',
    monthlyGenLimit: 0,
    totalGenLimit: 6,
    maxRoutes: 2,
    canEnrichDialogue: false,
    canRedeemRewards: false,
    canEditRoutes: false,
    canCreateRoutes: false,
    priceMonthly: 0,
    priceYearly: 0,
    benefits: [
      '场景生成 6 次（终身免费）',
      '每日路线 2 条预置',
      '完整学习闭环',
      '积分与等级系统',
      '语音识别跟读评分',
    ],
  },
  plus: {
    tier: 'plus',
    nameZh: 'Plus 版',
    nameEn: 'Plus',
    badge: '⭐',
    color: 'text-blue-600',
    gradient: 'from-blue-50 to-cyan-50',
    monthlyGenLimit: 90,
    totalGenLimit: 0,
    maxRoutes: 3,
    canEnrichDialogue: false,
    canRedeemRewards: false,
    canEditRoutes: true,
    canCreateRoutes: true,
    priceMonthly: 1900,
    priceYearly: 16800,
    benefits: [
      '场景生成 90 次/月',
      '每日路线最多 3 条',
      '可编辑 + 新建路线',
      '场景缓存复用',
      '无广告体验',
    ],
    highlight: true,
  },
  pro: {
    tier: 'pro',
    nameZh: 'Pro 版',
    nameEn: 'Pro',
    badge: '👑',
    color: 'text-purple-600',
    gradient: 'from-purple-50 to-pink-50',
    monthlyGenLimit: 150,
    totalGenLimit: 0,
    maxRoutes: 5,
    canEnrichDialogue: true,
    canRedeemRewards: true,
    canEditRoutes: true,
    canCreateRoutes: true,
    priceMonthly: 3900,
    priceYearly: 34800,
    benefits: [
      '包含 Plus 全部权益',
      '场景生成 150 次/月',
      '每日路线最多 5 条',
      '丰富对话细节（AI 重生成）',
      '积分兑换奖励',
      '优先体验新功能',
    ],
  },
};

export const TIER_ORDER: Tier[] = ['free', 'plus', 'pro'];

export function formatPrice(cents: number): string {
  if (cents === 0) return '免费';
  return `¥${(cents / 100).toFixed(0)}`;
}

export function yearlyPerMonth(cents: number): string {
  return `¥${(cents / 100 / 12).toFixed(1)}`;
}

export function yearlyDiscount(cents: number, monthly: number): number {
  if (monthly === 0 || cents === 0) return 0;
  const monthlyTotal = monthly * 12;
  return Math.round((1 - cents / monthlyTotal) * 100);
}

// 获取等级显示名
export function getTierName(tier: Tier | undefined | null): string {
  if (!tier) return '免费版';
  return TIER_CONFIGS[tier]?.nameZh || '免费版';
}

export function getTierBadge(tier: Tier | undefined | null): string {
  if (!tier) return '🆓';
  return TIER_CONFIGS[tier]?.badge || '🆓';
}
