import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LearnSession, SceneContent, Mastery, SceneSource, Difficulty } from '@/lib/types';
import { useHistoryStore } from './useHistoryStore';
import { useUserStore } from './useUserStore';

interface SessionState {
  session: LearnSession | null;
  generating: boolean;
  // 创建新会话
  createSession: (params: {
    sceneInput: string;
    source: SceneSource;
    content: SceneContent;
    difficulty?: Difficulty;
  }) => void;
  // 从历史记录恢复会话
  restoreSession: (session: LearnSession) => void;
  setContent: (content: SceneContent) => void;
  setMastery: (mastery: Mastery) => void;
  markLearnedDone: () => void;
  setPracticeRound: (round: number) => void;
  markPracticeDone: () => void;
  resetPractice: () => void;
  clearSession: () => void;
  setGenerating: (v: boolean) => void;
}

// 获取当前用户 ID（游客模式返回 null）
function getCurrentUserId(): string | null {
  const u = useUserStore.getState().currentUser;
  return u ? u.id : null;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      generating: false,
      createSession: ({ sceneInput, source, content, difficulty = 'easy' }) =>
        set(() => {
          const session: LearnSession = {
            id: 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            sceneInput,
            source,
            difficulty,
            content,
            mastery: null,
            learnedDone: false,
            practiceRound: 0,
            practiceDone: false,
            createdAt: Date.now(),
          };
          // 同时写入历史记录（按当前用户隔离；游客模式 userId=null，登录后不可见）
          useHistoryStore.getState().addEntry(session, getCurrentUserId());
          return { session };
        }),
      setContent: (content) =>
        set((s) => (s.session ? { session: { ...s.session, content } } : s)),
      restoreSession: (session) => set({ session }),
      setMastery: (mastery) =>
        set((s) => (s.session ? { session: { ...s.session, mastery } } : s)),
      markLearnedDone: () =>
        set((s) => {
          if (!s.session) return s;
          const updated = { ...s.session, learnedDone: true };
          useHistoryStore.getState().addEntry(updated, getCurrentUserId());
          return { session: updated };
        }),
      setPracticeRound: (round) =>
        set((s) => (s.session ? { session: { ...s.session, practiceRound: round } } : s)),
      markPracticeDone: () =>
        set((s) => {
          if (!s.session) return s;
          const updated = { ...s.session, practiceDone: true };
          useHistoryStore.getState().addEntry(updated, getCurrentUserId());
          return { session: updated };
        }),
      resetPractice: () =>
        set((s) =>
          s.session
            ? { session: { ...s.session, practiceRound: 0, practiceDone: false } }
            : s,
        ),
      clearSession: () => set({ session: null }),
      setGenerating: (v) => set({ generating: v }),
    }),
    {
      name: 'family-eng-session',
      partialize: (s) => ({ session: s.session }),
      // 从 localStorage 反序列化时校验/修复 content 结构，避免旧数据缺字段导致渲染白屏
      merge: (persisted, current) => {
        const state = current as SessionState;
        const raw = persisted as Partial<SessionState> | undefined;
        if (!raw || !raw.session) return state;
        const session = raw.session;
        const c = session.content;
        // 修复可能缺失或类型错误的数组字段
        session.content = {
          sceneNameZh: String(c?.sceneNameZh || ''),
          sceneNameEn: String(c?.sceneNameEn || ''),
          vocab: Array.isArray(c?.vocab) ? c.vocab : [],
          coreSentences: Array.isArray(c?.coreSentences) ? c.coreSentences : [],
          dialogue: Array.isArray(c?.dialogue) ? c.dialogue : [],
        };
        // 补全旧数据缺失的 difficulty 字段
        session.difficulty = session.difficulty || 'easy';
        return { ...state, session };
      },
    },
  ),
);
