// 积分系统：星 ⭐ 单位，按难度给分，完成闭环一次性发放，同一场景只计一次
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Difficulty } from '@/lib/types';
import { api, checkBackend, isAuthError } from '@/lib/api';

// 按难度配置的星数
export const DIFFICULTY_STARS: Record<Difficulty, number> = {
  easy: 10,
  medium: 20,
  hard: 30,
};

// 积分记录条目
export interface PointRecord {
  id: string;
  userId: string; // 归属用户
  sessionId: string; // 关联的学习会话（用于去重）
  sceneNameZh: string;
  difficulty: Difficulty;
  stars: number;
  earnedAt: number;
}

interface PointsState {
  records: PointRecord[];
  // 发放积分（完成闭环时调用），同一场景只计一次，返回本次获得的星数（0 表示已领过）
  // 同步到后端（后端同样做 sessionId 去重 + 归属校验，本地与后端保持一致）
  award: (params: {
    userId: string;
    sessionId: string;
    sceneNameZh: string;
    difficulty: Difficulty;
  }) => Promise<number>;
  // 获取某用户的总星数
  getTotalStars: (userId: string) => number;
  // 获取某用户的积分记录（按时间倒序）
  getRecordsByUser: (userId: string) => PointRecord[];
  // 检查某场景是否已领过积分
  hasAwarded: (sessionId: string) => boolean;
  // 清空某用户的所有积分记录（用于用户管理）
  clearByUser: (userId: string) => void;
  // 从后端加载积分记录（登录用户跨设备同步）
  loadFromBackend: (userId: string) => Promise<void>;
}

export const usePointsStore = create<PointsState>()(
  persist(
    (set, get) => ({
      records: [],

      award: async ({ userId, sessionId, sceneNameZh, difficulty }) => {
        const { records } = get();
        // 本地去重：同一场景只计一次
        if (records.some((r) => r.sessionId === sessionId)) {
          return 0;
        }
        const stars = DIFFICULTY_STARS[difficulty] ?? DIFFICULTY_STARS.easy;
        // 先写本地，保证 UI 立即反馈
        const record: PointRecord = {
          id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          userId,
          sessionId,
          sceneNameZh,
          difficulty,
          stars,
          earnedAt: Date.now(),
        };
        set((state) => ({ records: [record, ...state.records] }));
        // 同步到后端（后端同样做 sessionId 去重 + sessionId 归属校验）
        try {
          const up = await checkBackend();
          if (up) await api.awardPoints(sessionId, sceneNameZh, difficulty);
        } catch (err) {
          if (isAuthError(err)) return stars;
          // 后端失败不回滚本地（本地已发放，下次 loadFromBackend 会以后端为准纠正）
        }
        return stars;
      },

      getTotalStars: (userId) => {
        return get()
          .records.filter((r) => r.userId === userId)
          .reduce((sum, r) => sum + r.stars, 0);
      },

      getRecordsByUser: (userId) => {
        return get()
          .records.filter((r) => r.userId === userId)
          .sort((a, b) => b.earnedAt - a.earnedAt);
      },

      hasAwarded: (sessionId) => {
        return get().records.some((r) => r.sessionId === sessionId);
      },

      clearByUser: (userId) => {
        set((state) => ({
          records: state.records.filter((r) => r.userId !== userId),
        }));
      },
      loadFromBackend: async (userId: string) => {
        try {
          const up = await checkBackend();
          if (!up) return;
          const data = await api.getPointsRecords(100);
          const backendRecords: PointRecord[] = data.records.map((r: any) => ({
            id: r.id,
            userId,
            sessionId: r.session_id,
            sceneNameZh: r.scene_name_zh,
            difficulty: (r.difficulty || 'easy') as Difficulty,
            stars: r.stars,
            earnedAt: r.earned_at,
          }));
          set((state) => {
            // 合并：后端记录 + 本地非该用户的记录 + 本地该用户中后端没有的记录
            const backendIds = new Set(backendRecords.map((r) => r.id));
            const localOther = state.records.filter((r) => r.userId !== userId);
            const localExtra = state.records.filter(
              (r) => r.userId === userId && !backendIds.has(r.id),
            );
            const merged = [...backendRecords, ...localExtra, ...localOther].sort(
              (a, b) => b.earnedAt - a.earnedAt,
            );
            return { records: merged };
          });
        } catch (err) {
          if (isAuthError(err)) return;
          // 静默忽略网络错误
        }
      },
    }),
    { name: 'family-eng-points' },
  ),
);
