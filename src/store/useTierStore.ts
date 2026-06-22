// 会员等级 + 生成额度状态管理
import { create } from 'zustand';
import { api, checkBackend } from '@/lib/api';
import type { Tier } from '@/lib/tiers';
import { TIER_CONFIGS } from '@/lib/tiers';
import { useUserStore } from './useUserStore';

interface TierState {
  tier: Tier;
  tierExpireAt: number | null;
  monthlyGenCount: number;
  monthlyGenLimit: number;
  totalGenCount: number;
  totalGenLimit: number;
  canGenerate: boolean;
  canEnrichDialogue: boolean;
  canRedeemRewards: boolean;
  maxRoutes: number;
  loading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  // 检查是否可生成（前端校验，不增加计数）
  checkCanGenerate: () => boolean;
  // 生成成功后增加计数
  incrGenCount: () => Promise<boolean>;
  // 获取剩余次数描述
  getRemainingText: () => string;
}

export const useTierStore = create<TierState>((set, get) => ({
  tier: 'free',
  tierExpireAt: null,
  monthlyGenCount: 0,
  monthlyGenLimit: 0,
  totalGenCount: 0,
  totalGenLimit: 6,
  canGenerate: true,
  canEnrichDialogue: false,
  canRedeemRewards: false,
  maxRoutes: 2,
  loading: false,
  error: null,

  refresh: async () => {
    const currentUser = useUserStore.getState().currentUser;
    if (!currentUser) {
      // 未登录用游客模式：3 次免费
      set({
        tier: 'free',
        monthlyGenCount: 0,
        monthlyGenLimit: 0,
        totalGenCount: 0,
        totalGenLimit: 6,
        canGenerate: true,
        canEnrichDialogue: false,
        canRedeemRewards: false,
        maxRoutes: 2,
      });
      return;
    }
    set({ loading: true, error: null });
    try {
      const backendUp = await checkBackend();
      if (!backendUp) {
        // 后台不可用，用本地 tier
        const tier = currentUser.tier || 'free';
        const cfg = TIER_CONFIGS[tier];
        set({
          tier,
          tierExpireAt: currentUser.tierExpireAt,
          monthlyGenLimit: cfg.monthlyGenLimit,
          totalGenLimit: cfg.totalGenLimit,
          canGenerate: true,
          canEnrichDialogue: cfg.canEnrichDialogue,
          canRedeemRewards: cfg.canRedeemRewards,
          maxRoutes: cfg.maxRoutes,
          loading: false,
        });
        return;
      }
      const info = await api.getTierInfo();
      set({
        tier: info.tier,
        tierExpireAt: info.tierExpireAt,
        monthlyGenCount: info.monthlyGenCount,
        monthlyGenLimit: info.monthlyGenLimit,
        totalGenCount: info.totalGenCount,
        totalGenLimit: info.totalGenLimit,
        canGenerate: info.canGenerate,
        canEnrichDialogue: info.canEnrichDialogue,
        canRedeemRewards: info.canRedeemRewards,
        maxRoutes: info.maxRoutes,
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '获取等级信息失败' });
    }
  },

  checkCanGenerate: () => {
    const { canGenerate } = get();
    return canGenerate;
  },

  incrGenCount: async () => {
    const currentUser = useUserStore.getState().currentUser;
    if (!currentUser) {
      // 游客模式不调用后端
      return true;
    }
    try {
      const backendUp = await checkBackend();
      if (!backendUp) return true;
      const result = await api.incrGenCount();
      set({
        monthlyGenCount: result.monthlyGenCount,
        monthlyGenLimit: result.monthlyGenLimit,
        totalGenCount: result.totalGenCount,
        totalGenLimit: result.totalGenLimit,
        canGenerate: result.remaining !== 0,
      });
      return true;
    } catch (err) {
      // 超限或其他错误
      const msg = err instanceof Error ? err.message : '生成次数检查失败';
      if (msg.includes('上限') || msg.includes('用完')) {
        set({ canGenerate: false });
      }
      throw err;
    }
  },

  getRemainingText: () => {
    const { tier, monthlyGenCount, monthlyGenLimit, totalGenCount, totalGenLimit } = get();
    if (tier === 'free') {
      const remaining = Math.max(0, totalGenLimit - totalGenCount);
      return `${totalGenCount}/${totalGenLimit} 次（剩余 ${remaining}）`;
    }
    if (monthlyGenLimit > 0) {
      const remaining = Math.max(0, monthlyGenLimit - monthlyGenCount);
      return `${monthlyGenCount}/${monthlyGenLimit} 次/月（剩余 ${remaining}）`;
    }
    return '无限制';
  },
}));
