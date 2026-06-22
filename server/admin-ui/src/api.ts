const API_BASE = '/api';

// 获取 token
function getToken(): string | null {
  return localStorage.getItem('admin_token');
}

// 通用请求函数
async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
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
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/login';
    throw new Error('登录已过期');
  }
  
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.detail || '请求失败');
  }
  return data;
}

export const api = {
  // 认证
  login: (account: string, password: string) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ account, password }),
    }),
  
  // 仪表盘
  getDashboard: () => request('/admin/dashboard'),
  
  // 用户管理
  getUsers: (page = 1, pageSize = 20, search = '') =>
    request(`/admin/users?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`),
  getUser: (id: string) => request(`/admin/users/${id}`),
  updateUser: (id: string, data: any) =>
    request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateUserPassword: (id: string, newPassword: string) =>
    request(`/admin/users/${id}/password`, { method: 'PATCH', body: JSON.stringify({ newPassword }) }),
  adjustStars: (id: string, delta: number, reason: string) =>
    request(`/admin/users/${id}/stars`, { method: 'POST', body: JSON.stringify({ delta, reason }) }),
  deleteUser: (id: string) => request(`/admin/users/${id}`, { method: 'DELETE' }),
  // 设置用户权益（tier + 到期时间）
  setTier: (id: string, tier: 'free' | 'plus' | 'pro', expireAt: number | null, days?: number) =>
    request(`/admin/users/${id}/tier`, { method: 'POST', body: JSON.stringify({ tier, expireAt, days }) }),
  
  // LLM 设置（旧版单模型，保留兼容）
  getLlmConfig: () => request('/admin/settings/llm'),
  updateLlmConfig: (data: any) =>
    request('/admin/settings/llm', { method: 'POST', body: JSON.stringify(data) }),

  // LLM 多模型管理
  getLlmProviders: () => request<{ providers: any[]; mode: 'failover' | 'loadbalance' }>('/admin/llm-providers'),
  createLlmProvider: (data: any) =>
    request('/admin/llm-providers', { method: 'POST', body: JSON.stringify(data) }),
  updateLlmProvider: (id: string, data: any) =>
    request(`/admin/llm-providers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLlmProvider: (id: string) =>
    request(`/admin/llm-providers/${id}`, { method: 'DELETE' }),
  setLlmMode: (mode: 'failover' | 'loadbalance') =>
    request('/admin/llm-mode', { method: 'POST', body: JSON.stringify({ mode }) }),
  resetLlmProvider: (id: string) =>
    request(`/admin/llm-providers/${id}/reset`, { method: 'POST' }),
  testLlmProvider: (id: string) =>
    request(`/admin/llm-providers/${id}/test`, { method: 'POST' }),
  
  // 备份
  createBackup: () => request('/admin/backup', { method: 'POST' }),
  getBackups: () => request('/admin/backups'),
  
  // 系统
  getDiskInfo: () => request('/admin/system/disk'),
  getOnlineUsers: () => request('/admin/system/online-users'),
  getSystemStatus: () => request('/admin/system/status'),

  // 场景缓存
  getSceneCacheStats: () => request('/scene-cache/stats'),
  clearSceneCache: () => request('/scene-cache', { method: 'DELETE' }),

  // 日志
  getLogs: (page = 1, pageSize = 50) =>
    request(`/admin/logs?page=${page}&pageSize=${pageSize}`),
};
