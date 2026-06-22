// 前端 API 客户端：与后台 server 通信
// 后台未启动时降级到 localStorage（离线模式），保证 MVP 可用

// 生产环境（APK）使用线上服务器地址，开发环境用相对路径
const PROD_API_BASE = 'http://47.250.140.131:7500/api';
const DEV_API_BASE = '/api';
const isProd = import.meta.env.PROD;
const API_BASE = isProd ? PROD_API_BASE : DEV_API_BASE;

// 获取 token
export function getToken(): string | null {
  return localStorage.getItem('app_token');
}

// 设置 token
export function setToken(token: string): void {
  localStorage.setItem('app_token', token);
}

// 清除 token
export function clearToken(): void {
  localStorage.removeItem('app_token');
  localStorage.removeItem('app_user');
}

// 检查后台是否可用（通过健康检查）
let backendAvailable: boolean | null = null;
let lastCheckTime = 0;
const CHECK_INTERVAL = 30000; // 30 秒检查一次

export async function checkBackend(): Promise<boolean> {
  const now = Date.now();
  if (backendAvailable !== null && now - lastCheckTime < CHECK_INTERVAL) {
    return backendAvailable;
  }
  try {
    // 生产环境用完整 URL，开发环境用相对路径
    const healthUrl = isProd ? 'http://47.250.140.131:7500/health' : '/health';
    const res = await fetch(healthUrl, { method: 'GET' });
    backendAvailable = res.ok;
  } catch {
    backendAvailable = false;
  }
  lastCheckTime = now;
  return backendAvailable;
}

// 通用请求函数
async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
    throw new Error('登录已过期');
  }

  const data = await res.json() as T;
  if (!res.ok) {
    const errData = data as { error?: string; detail?: string };
    throw new Error(errData.error || errData.detail || '请求失败');
  }
  return data;
}

export const api = {
  // 认证
  register: (username: string, email: string, password: string, nickname?: string, avatar?: string) =>
    request<{ token: string; user: UserApiInfo }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, nickname, avatar }),
    }),
  login: (account: string, password: string) =>
    request<{ token: string; user: UserApiInfo }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ account, password }),
    }),
  getMe: () => request<UserApiInfo>('/auth/me'),

  // 积分
  awardPoints: (sessionId: string, sceneNameZh: string, difficulty: string) =>
    request<{ stars: number }>('/points/award', {
      method: 'POST',
      body: JSON.stringify({ sessionId, sceneNameZh, difficulty }),
    }),
  getPointsTotal: () => request<{ totalStars: number }>('/points/total'),
  getPointsRecords: (limit = 50) =>
    request<{ records: PointRecord[] }>(`/points/records?limit=${limit}`),

  // 学习会话
  createSession: (data: SessionPayload) =>
    request<{ id: string }>('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateSession: (id: string, data: SessionUpdatePayload) =>
    request<{ success: boolean }>(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getSessions: (page = 1, pageSize = 20) =>
    request<SessionsResponse>(`/sessions?page=${page}&pageSize=${pageSize}`),
  getSession: (id: string) => request<SessionData>(`/sessions/${id}`),

  // 场景缓存（所有用户共享，归一化匹配）
  checkSceneCache: (sceneInput: string, difficulty: string) =>
    request<SceneCacheHit>(`/scene-cache?sceneInput=${encodeURIComponent(sceneInput)}&difficulty=${difficulty}`),
  saveSceneCache: (sceneInput: string, difficulty: string, content: unknown) =>
    request<{ saved: boolean; cacheKey: string }>('/scene-cache', {
      method: 'POST',
      body: JSON.stringify({ sceneInput, difficulty, content }),
    }),

  // 会员等级
  getTierInfo: () => request<TierInfo>('/tier/me'),
  incrGenCount: () => request<GenCountResult>('/tier/incr-gen', { method: 'POST' }),
  upgradeTier: (tier: 'plus' | 'pro', durationDays = 365) =>
    request<{ success: boolean; tier: string; tierExpireAt: number; message: string }>('/tier/upgrade', {
      method: 'POST',
      body: JSON.stringify({ tier, durationDays }),
    }),
  downgradeTier: () => request<{ success: boolean; tier: string }>('/tier/downgrade', { method: 'POST' }),

  // 奖励（Pro 专属）
  getRewards: () => request<RewardsResponse>('/rewards'),
  createReward: (data: { name: string; description?: string; starCost: number; icon?: string }) =>
    request<RewardItem>('/rewards', { method: 'POST', body: JSON.stringify(data) }),
  updateReward: (id: string, data: { name?: string; description?: string; starCost?: number; icon?: string }) =>
    request<{ success: boolean }>(`/rewards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteReward: (id: string) => request<{ success: boolean }>(`/rewards/${id}`, { method: 'DELETE' }),
  redeemReward: (id: string) =>
    request<{ success: boolean; rewardName: string; starsSpent: number; totalStars: number; message: string }>(`/rewards/${id}/redeem`, { method: 'POST' }),
  getRedemptions: (limit = 50) =>
    request<{ redemptions: RedemptionItem[] }>(`/rewards/redemptions?limit=${limit}`),
};

// 类型定义
interface UserApiInfo {
  id: string;
  username: string;
  email: string;
  nickname: string;
  avatar: string;
  role: 'user' | 'admin';
  totalStars: number;
  vipLevel: number;
  tier: 'free' | 'plus' | 'pro';
  tierExpireAt: number | null;
  createdAt: number;
  lastLoginAt?: number;
}

interface PointRecord {
  id: string;
  user_id: string;
  session_id: string;
  scene_name_zh: string;
  difficulty: string;
  stars: number;
  earned_at: number;
}

interface SessionPayload {
  sceneInput: string;
  sceneNameZh: string;
  sceneNameEn: string;
  source: string;
  difficulty: string;
  content: unknown;
}

interface SessionUpdatePayload {
  learnedDone?: boolean;
  practiceDone?: boolean;
  practiceRound?: number;
}

interface SessionData {
  id: string;
  user_id: string;
  scene_input: string;
  scene_name_zh: string;
  scene_name_en: string;
  source: string;
  difficulty: string;
  content: unknown;
  learned_done: number;
  practice_done: number;
  practice_round: number;
  created_at: number;
  updated_at: number;
  learnedDone: boolean;
  practiceDone: boolean;
}

interface SessionsResponse {
  sessions: SessionData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface SceneCacheHit {
  hit: boolean;
  sceneInput: string;
  difficulty: string;
  content: unknown;
  createdAt: number;
  hitCount: number;
}

interface TierInfo {
  tier: 'free' | 'plus' | 'pro';
  tierName: string;
  tierBadge: string;
  tierExpireAt: number | null;
  monthlyGenCount: number;
  monthlyGenLimit: number;
  totalGenCount: number;
  totalGenLimit: number;
  canGenerate: boolean;
  canEnrichDialogue: boolean;
  canRedeemRewards: boolean;
  maxRoutes: number;
  totalStars: number;
}

interface GenCountResult {
  success: boolean;
  monthlyGenCount: number;
  monthlyGenLimit: number;
  totalGenCount: number;
  totalGenLimit: number;
  remaining: number;
}

interface RewardItem {
  id: string;
  name: string;
  description: string;
  starCost: number;
  icon: string;
  isPreset: boolean;
  sortOrder: number;
}

interface RewardsResponse {
  rewards: RewardItem[];
  totalStars: number;
  canRedeem: boolean;
}

interface RedemptionItem {
  id: string;
  rewardName: string;
  starsSpent: number;
  redeemedAt: number;
}
