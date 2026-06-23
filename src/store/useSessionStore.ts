import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LearnSession, SceneContent, Mastery, SceneSource, Difficulty } from '@/lib/types';
import { useHistoryStore } from './useHistoryStore';
import { useUserStore } from './useUserStore';
import { api, checkBackend, isAuthError } from '@/lib/api';

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

// 同步 session 到后端数据库（登录用户才同步，游客跳过）
function syncSessionToBackend(session: LearnSession) {
  const user = useUserStore.getState().currentUser;
  if (!user) return; // 游客不同步

  checkBackend().then((up) => {
    if (!up) return;
    // 用 PATCH 更新已有 session（包括 content、状态等）
    api.updateSession(session.id, {
      content: session.content,
      sceneNameZh: session.content.sceneNameZh,
      sceneNameEn: session.content.sceneNameEn,
      learnedDone: session.learnedDone,
      practiceDone: session.practiceDone,
      practiceRound: session.practiceRound,
    })
      .catch((err) => {
        if (isAuthError(err)) return;
        // session 不存在（可能是旧数据），尝试创建
        api.createSession({
          sceneInput: session.sceneInput,
          sceneNameZh: session.content.sceneNameZh,
          sceneNameEn: session.content.sceneNameEn,
          source: session.source,
          difficulty: session.difficulty || 'easy',
          content: session.content,
        }).catch(() => {});
      });
  }).catch(() => {});
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
          // 异步同步到后端数据库（登录用户跨设备可见）
          syncSessionToBackend(session);
          return { session };
        }),
      setContent: (content) =>
        set((s) => {
          if (!s.session) return s;
          const updated = { ...s.session, content };
          // 同步到历史记录（更新本地）
          useHistoryStore.getState().addEntry(updated, getCurrentUserId());
          // 同步到后端数据库（更新 content）
          syncSessionToBackend(updated);
          return { session: updated };
        }),
      restoreSession: (session) => set({ session }),
      setMastery: (mastery) =>
        set((s) => (s.session ? { session: { ...s.session, mastery } } : s)),
      markLearnedDone: () =>
        set((s) => {
          if (!s.session) return s;
          const updated = { ...s.session, learnedDone: true };
          useHistoryStore.getState().addEntry(updated, getCurrentUserId());
          syncSessionToBackend(updated);
          return { session: updated };
        }),
      setPracticeRound: (round) =>
        set((s) => (s.session ? { session: { ...s.session, practiceRound: round } } : s)),
      markPracticeDone: () =>
        set((s) => {
          if (!s.session) return s;
          const updated = { ...s.session, practiceDone: true };
          useHistoryStore.getState().addEntry(updated, getCurrentUserId());
          syncSessionToBackend(updated);
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
