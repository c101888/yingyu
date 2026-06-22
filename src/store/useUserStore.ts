// 用户系统：支持后端 API（登录后跨设备同步）+ localStorage 降级（离线/游客模式）
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, setToken, clearToken, checkBackend } from '@/lib/api';
import type { Tier } from '@/lib/tiers';

export interface LocalUser {
  id: string;
  username: string;
  email: string;
  nickname: string;
  avatar: string;
  role: 'user' | 'admin';
  totalStars: number;
  vipLevel: number;
  tier: Tier;
  tierExpireAt: number | null;
  createdAt: number;
  lastLoginAt?: number;
}

interface UserState {
  currentUser: LocalUser | null;
  users: LocalUser[]; // 仅 localStorage 模式下的本地用户列表
  guestUsageCount: number;
  guestMaxUsage: number;
  loading: boolean;
  error: string | null;

  // 后端 API 方式
  register: (username: string, email: string, password: string, nickname?: string, avatar?: string) => Promise<LocalUser>;
  login: (account: string, password: string) => Promise<LocalUser>;
  logout: () => void;
  refreshMe: () => Promise<void>;

  // 游客模式
  incrementGuestUsage: () => void;
  canGuestUse: () => boolean;
  resetGuestUsage: () => void;
}

export const GUEST_MAX_USAGE = 3;

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      users: [],
      guestUsageCount: 0,
      guestMaxUsage: GUEST_MAX_USAGE,
      loading: false,
      error: null,

      register: async (username, email, password, nickname, avatar) => {
        set({ loading: true, error: null });
        try {
          const backendUp = await checkBackend();
          if (backendUp) {
            const { token, user } = await api.register(username, email, password, nickname, avatar);
            setToken(token);
            const localUser: LocalUser = {
              id: user.id,
              username: user.username,
              email: user.email,
              nickname: user.nickname,
              avatar: user.avatar,
              role: user.role,
              totalStars: user.totalStars || 0,
              vipLevel: user.vipLevel || 0,
              tier: user.tier || 'free',
              tierExpireAt: user.tierExpireAt || null,
              createdAt: Date.now(),
            };
            set({ currentUser: localUser, guestUsageCount: 0, loading: false });
            return localUser;
          }
          throw new Error('后台服务未启动，无法注册。请先启动后台服务（server 目录）');
        } catch (err) {
          set({ loading: false, error: err instanceof Error ? err.message : '注册失败' });
          throw err;
        }
      },

      login: async (account, password) => {
        set({ loading: true, error: null });
        try {
          const backendUp = await checkBackend();
          if (backendUp) {
            const { token, user } = await api.login(account, password);
            setToken(token);
            const localUser: LocalUser = {
              id: user.id,
              username: user.username,
              email: user.email,
              nickname: user.nickname,
              avatar: user.avatar,
              role: user.role,
              totalStars: user.totalStars || 0,
              vipLevel: user.vipLevel || 0,
              tier: user.tier || 'free',
              tierExpireAt: user.tierExpireAt || null,
              createdAt: Date.now(),
              lastLoginAt: Date.now(),
            };
            set({ currentUser: localUser, guestUsageCount: 0, loading: false });
            return localUser;
          }
          throw new Error('后台服务未启动，无法登录。请先启动后台服务（server 目录）');
        } catch (err) {
          set({ loading: false, error: err instanceof Error ? err.message : '登录失败' });
          throw err;
        }
      },

      logout: () => {
        clearToken();
        set({ currentUser: null });
      },

      refreshMe: async () => {
        try {
          const user = await api.getMe();
          const localUser: LocalUser = {
            id: user.id,
            username: user.username,
            email: user.email,
            nickname: user.nickname,
            avatar: user.avatar,
            role: user.role,
            totalStars: user.totalStars || 0,
            vipLevel: user.vipLevel || 0,
            tier: user.tier || 'free',
            tierExpireAt: user.tierExpireAt || null,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
          };
          set({ currentUser: localUser });
        } catch {
          // 忽略刷新失败
        }
      },

      incrementGuestUsage: () => set((state) => ({ guestUsageCount: state.guestUsageCount + 1 })),
      canGuestUse: () => {
        const { currentUser, guestUsageCount, guestMaxUsage } = get();
        if (currentUser) return true;
        return guestUsageCount < guestMaxUsage;
      },
      resetGuestUsage: () => set({ guestUsageCount: 0 }),
    }),
    {
      name: 'family-eng-user',
      partialize: (s) => ({
        currentUser: s.currentUser,
        guestUsageCount: s.guestUsageCount,
        guestMaxUsage: s.guestMaxUsage,
      }),
    },
  ),
);
