// LLM 多模型调度器
// 支持两种模式（管理员可切换，二选一）：
//   - failover（顺序轮切）：按 priority 顺序尝试，故障自动切下一个
//   - loadbalance（并发分流）：按 max_concurrency 限制并发，超出分配给其他可用模型
//
// 故障判断：HTTP 5xx、超时（>30s）、429 限流、网络错误 = 故障
//          4xx 参数错误不切换（调用方问题）
// 故障处理：fail_count++，达到阈值（3次）进入冷却（60s），冷却期跳过该模型

import { getDb } from '../db/index.js';
import { config } from '../config.js';

export type LlmMode = 'failover' | 'loadbalance';

export interface LlmProvider {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  priority: number;
  is_active: number;
  max_concurrency: number;
  fail_count: number;
  cooldown_until: number;
  last_used_at: number | null;
  last_error: string | null;
}

// 运行时并发计数（loadbalance 模式用）
const concurrencyMap = new Map<string, number>();
const FAIL_THRESHOLD = 3;
const COOLDOWN_MS = 60000;
const REQUEST_TIMEOUT_MS = 30000;

// 获取当前模式
export function getLlmMode(): LlmMode {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('llm_mode') as { value: string } | undefined;
  return (row?.value as LlmMode) || 'failover';
}

// 设置当前模式
export function setLlmMode(mode: LlmMode): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES ('llm_mode', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
  `).run(mode, now, mode, now);
}

// 获取所有启用的 provider（按 priority 排序）
export function getActiveProviders(): LlmProvider[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM llm_providers WHERE is_active = 1 ORDER BY priority ASC, created_at ASC
  `).all() as LlmProvider[];
}

// 判断 provider 是否可用（未冷却）
function isAvailable(p: LlmProvider): boolean {
  if (p.cooldown_until > Date.now()) return false;
  return true;
}

// 判断是否为故障错误（需要切换）
function isFailureError(status: number | null, err: unknown): boolean {
  if (err) return true; // 网络错误、超时
  if (status === null) return true;
  if (status >= 500) return true; // 服务器错误
  if (status === 429) return true; // 限流
  return false; // 4xx 其他视为调用方问题，不切换
}

// 标记故障
function markFailure(providerId: string, errorMsg: string): void {
  const db = getDb();
  const p = db.prepare('SELECT fail_count FROM llm_providers WHERE id = ?').get(providerId) as { fail_count: number } | undefined;
  if (!p) return;
  const newFailCount = p.fail_count + 1;
  const shouldCooldown = newFailCount >= FAIL_THRESHOLD;
  const now = Date.now();
  db.prepare(`
    UPDATE llm_providers
    SET fail_count = ?, last_error = ?, cooldown_until = ?, updated_at = ?
    WHERE id = ?
  `).run(
    newFailCount,
    errorMsg.slice(0, 500),
    shouldCooldown ? now + COOLDOWN_MS : 0,
    now,
    providerId,
  );
}

// 标记成功（重置故障计数）
function markSuccess(providerId: string): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(`
    UPDATE llm_providers
    SET fail_count = 0, cooldown_until = 0, last_error = NULL, last_used_at = ?, updated_at = ?
    WHERE id = ?
  `).run(now, now, providerId);
}

// 获取当前并发数
function getConcurrency(providerId: string): number {
  return concurrencyMap.get(providerId) || 0;
}

// 增减并发计数
function incConcurrency(providerId: string): void {
  concurrencyMap.set(providerId, getConcurrency(providerId) + 1);
}
function decConcurrency(providerId: string): void {
  const cur = getConcurrency(providerId);
  concurrencyMap.set(providerId, Math.max(0, cur - 1));
}

// failover 模式：按 priority 顺序尝试，故障切下一个
async function callWithFailover(payload: unknown): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const providers = getActiveProviders().filter(isAvailable);
  if (providers.length === 0) {
    return { ok: false, error: '没有可用的 LLM 模型（全部冷却中或未配置）' };
  }

  let lastError = '';
  for (const p of providers) {
    try {
      const result = await callProvider(p, payload);
      if (result.ok) {
        markSuccess(p.id);
        return result;
      }
      // 故障：记录并尝试下一个
      lastError = result.error;
      markFailure(p.id, result.error);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      markFailure(p.id, lastError);
    }
  }
  return { ok: false, error: `所有 LLM 模型均失败。最后错误：${lastError}` };
}

// loadbalance 模式：选择并发最低的可用 provider
async function callWithLoadbalance(payload: unknown): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const providers = getActiveProviders().filter(isAvailable);
  if (providers.length === 0) {
    return { ok: false, error: '没有可用的 LLM 模型（全部冷却中或未配置）' };
  }

  // 按当前并发数升序、priority 升序排序，选第一个未满的
  const sorted = [...providers].sort((a, b) => {
    const ca = getConcurrency(a.id);
    const cb = getConcurrency(b.id);
    if (ca < cb) return -1;
    if (ca > cb) return 1;
    return a.priority - b.priority;
  });

  // 找一个未达并发上限的
  const target = sorted.find((p) => getConcurrency(p.id) < p.max_concurrency) || sorted[0];

  incConcurrency(target.id);
  try {
    const result = await callProvider(target, payload);
    if (result.ok) {
      markSuccess(target.id);
      return result;
    }
    markFailure(target.id, result.error);
    // 故障后，递归尝试剩余可用 provider（不再选当前这个）
    return callWithLoadbalance(payload);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    markFailure(target.id, errMsg);
    return callWithLoadbalance(payload);
  } finally {
    decConcurrency(target.id);
  }
}

// 调用单个 provider
async function callProvider(
  p: LlmProvider,
  payload: unknown,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string; status?: number }> {
  const url = `${p.base_url.replace(/\/$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${p.api_key}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (isFailureError(res.status, null)) {
        return { ok: false, error: `HTTP ${res.status}: ${errText.slice(0, 200)}`, status: res.status };
      }
      // 4xx 非故障：直接返回错误，不切换
      return { ok: false, error: `HTTP ${res.status}: ${errText.slice(0, 200)}`, status: res.status };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: '请求超时（30s）' };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

// 主入口：根据当前模式调度
export async function callLlm(messages: Array<{ role: string; content: string }>, options?: { temperature?: number }): Promise<unknown> {
  const mode = getLlmMode();
  const payload = {
    model: undefined, // 由 provider 决定
    messages,
    temperature: options?.temperature ?? 0.7,
  };

  // 注入 model 字段在 callProvider 中需要，这里在 payload 里留空，实际调用时替换
  // 重新设计：callProvider 用 provider.model
  const providers = getActiveProviders();
  if (providers.length === 0) {
    // 降级到环境变量默认配置
    return callDefaultEnv(messages, options);
  }

  // 包装 payload，让 callProvider 用 provider.model
  const result = mode === 'failover'
    ? await callWithFailoverImpl(messages, options)
    : await callWithLoadbalanceImpl(messages, options);

  if (!result.ok) {
    // 全部失败，降级到环境变量
    console.warn('⚠️ 所有 LLM provider 失败，降级到环境变量默认配置：', result.error);
    return callDefaultEnv(messages, options);
  }
  return result.data;
}

// 实际 failover 实现（带 model 注入）
async function callWithFailoverImpl(messages: Array<{ role: string; content: string }>, options?: { temperature?: number }): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const providers = getActiveProviders().filter(isAvailable);
  if (providers.length === 0) return { ok: false, error: '无可用 provider' };

  let lastError = '';
  for (const p of providers) {
    try {
      const result = await callProvider(p, {
        model: p.model,
        messages,
        temperature: options?.temperature ?? 0.7,
      });
      if (result.ok) {
        markSuccess(p.id);
        return result;
      }
      if (isFailureError(result.status ?? null, null)) {
        lastError = result.error;
        markFailure(p.id, result.error);
        continue; // 切下一个
      }
      // 非故障错误，直接返回
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      markFailure(p.id, lastError);
    }
  }
  return { ok: false, error: `所有 provider 失败：${lastError}` };
}

// 实际 loadbalance 实现
async function callWithLoadbalanceImpl(messages: Array<{ role: string; content: string }>, options?: { temperature?: number }): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const providers = getActiveProviders().filter(isAvailable);
  if (providers.length === 0) return { ok: false, error: '无可用 provider' };

  const sorted = [...providers].sort((a, b) => {
    const ca = getConcurrency(a.id);
    const cb = getConcurrency(b.id);
    if (ca < cb) return -1;
    if (ca > cb) return 1;
    return a.priority - b.priority;
  });

  const target = sorted.find((p) => getConcurrency(p.id) < p.max_concurrency) || sorted[0];

  incConcurrency(target.id);
  try {
    const result = await callProvider(target, {
      model: target.model,
      messages,
      temperature: options?.temperature ?? 0.7,
    });
    if (result.ok) {
      markSuccess(target.id);
      return result;
    }
    if (isFailureError(result.status ?? null, null)) {
      markFailure(target.id, result.error);
      // 递归尝试剩余
      return callWithLoadbalanceImpl(messages, options);
    }
    return result;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    markFailure(target.id, errMsg);
    return callWithLoadbalanceImpl(messages, options);
  } finally {
    decConcurrency(target.id);
  }
}

// 降级：使用环境变量配置
async function callDefaultEnv(messages: Array<{ role: string; content: string }>, options?: { temperature?: number }): Promise<unknown> {
  const apiKey = config.arkApiKey;
  const baseUrl = config.arkBaseUrl;
  if (!apiKey) throw new Error('未配置 LLM（无 provider，环境变量 ARK_API_KEY 也为空）');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-5.2',
        messages,
        temperature: options?.temperature ?? 0.7,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`默认 LLM 调用失败 HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
