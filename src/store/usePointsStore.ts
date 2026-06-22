// 积分系统：星 ⭐ 单位，按难度给分，完成闭环一次性发放，同一场景只计一次
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Difficulty } from '@/lib/types';

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
  award: (params: {
    userId: string;
    sessionId: string;
    sceneNameZh: string;
    difficulty: Difficulty;
  }) => number;
  // 获取某用户的总星数
  getTotalStars: (userId: string) => number;
  // 获取某用户的积分记录（按时间倒序）
  getRecordsByUser: (userId: string) => PointRecord[];
  // 检查某场景是否已领过积分
  hasAwarded: (sessionId: string) => boolean;
  // 清空某用户的所有积分记录（用于用户管理）
  clearByUser: (userId: string) => void;
}

export const usePointsStore = create<PointsState>()(
  persist(
    (set, get) => ({
      records: [],

      award: ({ userId, sessionId, sceneNameZh, difficulty }) => {
        const { records } = get();
        // 同一场景只计一次
        if (records.some((r) => r.sessionId === sessionId)) {
          return 0;
        }
        const stars = DIFFICULTY_STARS[difficulty] ?? DIFFICULTY_STARS.easy;
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
    }),
    { name: 'family-eng-points' },
  ),
);
