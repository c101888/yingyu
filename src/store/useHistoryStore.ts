import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LearnSession, Difficulty } from '@/lib/types';
import { api, checkBackend, isAuthError } from '@/lib/api';

// 历史记录中保存的精简信息（用于列表展示 + 恢复）
export interface HistoryEntry {
  id: string;
  // 归属用户 ID（null 表示游客模式生成，登录后不可见）
  userId: string | null;
  sceneInput: string;
  sceneNameZh: string;
  sceneNameEn: string;
  source: LearnSession['source'];
  difficulty: Difficulty;
  learnedDone: boolean;
  practiceDone: boolean;
  createdAt: number;
  // 完整 session 内容，用于恢复
  session: LearnSession;
}

interface HistoryState {
  entries: HistoryEntry[];
  addEntry: (session: LearnSession, userId: string | null) => void;
  removeEntry: (id: string) => void;
  clearHistory: () => void;
  getEntry: (id: string) => HistoryEntry | undefined;
  // 按用户过滤（null 表示只看游客数据）
  getByUser: (userId: string | null) => HistoryEntry[];
  // 清空某用户的所有记录
  clearByUser: (userId: string) => void;
  // 清空游客数据
  clearGuest: () => void;
  // 从后端数据库加载历史记录（登录用户跨设备同步）
  loadFromBackend: (userId: string) => Promise<void>;
}

// 上限放大到 200，配合历史记录页分页（每页 20 条，最多 10 页）
const MAX_HISTORY = 200;

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: [],
      addEntry: (session, userId) =>
        set((state) => {
          // 去重：同 sceneInput + 同 userId 只保留最新一条
          const filtered = state.entries.filter(
            (e) => !(e.sceneInput === session.sceneInput && e.userId === userId),
          );
          const entry: HistoryEntry = {
            id: session.id,
            userId,
            sceneInput: session.sceneInput,
            sceneNameZh: session.content.sceneNameZh,
            sceneNameEn: session.content.sceneNameEn,
            source: session.source,
            difficulty: session.difficulty || 'easy',
            learnedDone: session.learnedDone,
            practiceDone: session.practiceDone,
            createdAt: session.createdAt,
            session,
          };
          // 最新的在前，最多保留 MAX_HISTORY 条
          return { entries: [entry, ...filtered].slice(0, MAX_HISTORY) };
        }),
      removeEntry: (id) =>
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),
      clearHistory: () => set({ entries: [] }),
      getEntry: (id) => get().entries.find((e) => e.id === id),
      getByUser: (userId) =>
        get().entries.filter((e) => e.userId === userId),
      clearByUser: (userId) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.userId !== userId),
        })),
      clearGuest: () =>
        set((state) => ({
          entries: state.entries.filter((e) => e.userId !== null),
        })),
      loadFromBackend: async (userId: string) => {
        try {
          const up = await checkBackend();
          if (!up) return;
          const data = await api.getSessions(1, 100);
          // 将后端 sessions 转换为 HistoryEntry 格式，合并到本地（去重）
          const backendEntries: HistoryEntry[] = data.sessions.map((s: any) => ({
            id: s.id,
            userId,
            sceneInput: s.scene_input || '',
            sceneNameZh: s.scene_name_zh || '',
            sceneNameEn: s.scene_name_en || '',
            source: s.source || 'input',
            difficulty: s.difficulty || 'easy',
            learnedDone: !!s.learnedDone,
            practiceDone: !!s.practiceDone,
            createdAt: s.created_at || Date.now(),
            session: {
              id: s.id,
              sceneInput: s.scene_input || '',
              source: s.source || 'input',
              difficulty: s.difficulty || 'easy',
              content: s.content,
              mastery: null,
              learnedDone: !!s.learnedDone,
              practiceRound: s.practice_round || 0,
              practiceDone: !!s.practiceDone,
              createdAt: s.created_at || Date.now(),
            } as LearnSession,
          }));
          set((state) => {
            // 合并：后端记录 + 本地非该用户的记录 + 本地该用户中后端没有的记录
            const backendIds = new Set(backendEntries.map((e) => e.id));
            const localOther = state.entries.filter((e) => e.userId !== userId);
            const localExtra = state.entries.filter(
              (e) => e.userId === userId && !backendIds.has(e.id),
            );
            const merged = [...backendEntries, ...localExtra, ...localOther]
              .sort((a, b) => b.createdAt - a.createdAt)
              .slice(0, MAX_HISTORY);
            return { entries: merged };
          });
        } catch (err) {
          if (isAuthError(err)) return;
          // 静默忽略网络错误
        }
      },
    }),
    {
      name: 'family-eng-history',
      // 从 localStorage 反序列化时补全旧数据缺失的字段
      merge: (persisted, current) => {
        const state = current as HistoryState;
        const raw = persisted as Partial<HistoryState> | undefined;
        if (!raw || !Array.isArray(raw.entries)) return state;
        const entries = raw.entries.map((e) => ({
          ...e,
          userId: e.userId ?? null, // 旧数据补全为 null（游客）
          difficulty: (e.difficulty || 'easy') as Difficulty,
          session: {
            ...e.session,
            difficulty: (e.session?.difficulty || 'easy') as Difficulty,
          },
        }));
        return { ...state, entries };
      },
    },
  ),
);
