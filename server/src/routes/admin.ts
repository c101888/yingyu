import { Router, Response } from 'express';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { hashPassword, generateId } from '../utils/crypto.js';
import { adminRequired, AuthRequest } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const router = Router();

// 所有管理员路由都需要管理员权限
router.use(adminRequired);

// === 用户管理 ===

// 用户列表（分页 + 搜索）
router.get('/users', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 20);
  const offset = (page - 1) * pageSize;
  const search = (req.query.search as string) || '';
  
  let where = "status != 'deleted'";
  const params: any[] = [];
  if (search) {
    where += " AND (username LIKE ? OR email LIKE ? OR nickname LIKE ?)";
    const kw = `%${search}%`;
    params.push(kw, kw, kw);
  }
  
  const total = (db.prepare(`SELECT COUNT(*) as count FROM users WHERE ${where}`).get(...params) as any).count;
  const users = db.prepare(`
    SELECT id, username, email, nickname, avatar, role, status, total_stars, tier, tier_expire_at, vip_level, vip_expire_at, created_at, last_login_at
    FROM users WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  res.json({ users, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

// 获取单个用户详情
router.get('/users/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT id, username, email, nickname, avatar, role, status, total_stars, tier, tier_expire_at, vip_level, vip_expire_at, created_at, updated_at, last_login_at
    FROM users WHERE id = ?
  `).get(req.params.id) as any;
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  res.json(user);
});

// 编辑用户
router.patch('/users/:id', (req: AuthRequest, res: Response) => {
  try {
    const { nickname, avatar, status, role } = req.body;
    const db = getDb();

    // L3: 校验目标用户是否存在
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    // L2: 值域校验
    if (nickname !== undefined && (typeof nickname !== 'string' || nickname.length < 1 || nickname.length > 20)) {
      res.status(400).json({ error: '昵称需 1-20 个字符' });
      return;
    }
    if (avatar !== undefined && (typeof avatar !== 'string' || avatar.length > 10)) {
      res.status(400).json({ error: '头像不合法' });
      return;
    }
    if (status !== undefined && !['active', 'frozen', 'deleted'].includes(status)) {
      res.status(400).json({ error: '无效的状态' });
      return;
    }
    if (role !== undefined && !['user', 'admin'].includes(role)) {
      res.status(400).json({ error: '无效的角色' });
      return;
    }

    const now = Date.now();
    const updates: string[] = [];
    const params: any[] = [];
    if (nickname !== undefined) { updates.push('nickname = ?'); params.push(nickname); }
    if (avatar !== undefined) { updates.push('avatar = ?'); params.push(avatar); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    updates.push('updated_at = ?'); params.push(now);
    params.push(req.params.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    // 记录管理员操作日志
    db.prepare(`
      INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, detail, created_at)
      VALUES (?, ?, 'edit_user', 'user', ?, ?, ?)
    `).run(generateId('log'), req.userId, req.params.id, JSON.stringify(req.body), now);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '更新用户失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// 修改用户密码
router.patch('/users/:id/password', async (req: AuthRequest, res: Response) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: '密码至少 6 位' });
      return;
    }
    const db = getDb();
    // L3: 校验目标用户是否存在
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }
    const hash = await hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(hash, Date.now(), req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '修改密码失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// 增减用户积分
router.post('/users/:id/stars', (req: AuthRequest, res: Response) => {
  try {
    const { delta, reason } = req.body;
    if (typeof delta !== 'number') {
      res.status(400).json({ error: 'delta 必须是数字' });
      return;
    }
    const db = getDb();
    const user = db.prepare('SELECT total_stars FROM users WHERE id = ?').get(req.params.id) as any;
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }
    const newTotal = Math.max(0, user.total_stars + delta);
    db.prepare('UPDATE users SET total_stars = ?, updated_at = ? WHERE id = ?')
      .run(newTotal, Date.now(), req.params.id);
    
    // 记录管理员操作日志
    db.prepare(`
      INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, detail, created_at)
      VALUES (?, ?, 'adjust_stars', 'user', ?, ?, ?)
    `).run(generateId('log'), req.userId, req.params.id, JSON.stringify({ delta, reason, newTotal }), Date.now());
    
    res.json({ success: true, totalStars: newTotal });
  } catch (err) {
    res.status(500).json({ error: '调整积分失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// 删除用户（软删除）
router.delete('/users/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  db.prepare("UPDATE users SET status = 'deleted', updated_at = ? WHERE id = ?")
    .run(Date.now(), req.params.id);
  
  db.prepare(`
    INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, detail, created_at)
    VALUES (?, ?, 'delete_user', 'user', ?, ?, ?)
  `).run(generateId('log'), req.userId, req.params.id, '', Date.now());
  
  res.json({ success: true });
});

// === 用户权益管理（tier：free / plus / pro） ===

// 设置用户权益（tier + 到期时间）
// 支持自定义到期时间戳，或快捷天数（3天/30天/90天/365天）
router.post('/users/:id/tier', (req: AuthRequest, res: Response) => {
  try {
    const { tier, expireAt, days } = req.body as {
      tier: 'free' | 'plus' | 'pro';
      expireAt?: number | null;
      days?: number;
    };
    if (!['free', 'plus', 'pro'].includes(tier)) {
      res.status(400).json({ error: 'tier 必须是 free / plus / pro 之一' });
      return;
    }
    const db = getDb();

    // 计算到期时间：优先 expireAt，其次 days，free 为 null
    let finalExpireAt: number | null = null;
    if (tier === 'free') {
      finalExpireAt = null;
    } else if (typeof expireAt === 'number' && expireAt > 0) {
      finalExpireAt = expireAt;
    } else if (typeof days === 'number' && days > 0) {
      finalExpireAt = Date.now() + days * 86400000;
    } else {
      res.status(400).json({ error: 'plus/pro 必须提供 expireAt 或 days' });
      return;
    }

    db.prepare('UPDATE users SET tier = ?, tier_expire_at = ?, updated_at = ? WHERE id = ?')
      .run(tier, finalExpireAt, Date.now(), req.params.id);

    db.prepare(`
      INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, detail, created_at)
      VALUES (?, ?, 'set_tier', 'user', ?, ?, ?)
    `).run(generateId('log'), req.userId, req.params.id, JSON.stringify({ tier, expireAt: finalExpireAt }), Date.now());

    res.json({ success: true, tier, tierExpireAt: finalExpireAt });
  } catch (err) {
    res.status(500).json({ error: '设置用户权益失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// === LLM 设置 ===

// 获取 LLM 配置（旧版单模型，保留兼容）
router.get('/settings/llm', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('llm_config') as any;
  res.json(row ? JSON.parse(row.value) : { apiKey: '', baseUrl: '', model: '' });
});

// 更新 LLM 配置（旧版单模型，保留兼容）
router.post('/settings/llm', (req: AuthRequest, res: Response) => {
  try {
    const { apiKey, baseUrl, model } = req.body;
    const db = getDb();
    const value = JSON.stringify({ apiKey, baseUrl, model });
    const now = Date.now();

    db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES ('llm_config', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
    `).run(value, now, value, now);

    db.prepare(`
      INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, detail, created_at)
      VALUES (?, ?, 'update_llm_config', 'settings', 'llm_config', ?, ?)
    `).run(generateId('log'), req.userId, JSON.stringify({ baseUrl, model }), now);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '更新 LLM 配置失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// === LLM 多模型管理（顺序轮切 / 并发分流） ===

import { getLlmMode, setLlmMode, type LlmMode } from '../lib/llmScheduler.js';

// 获取所有 LLM provider + 当前模式
router.get('/llm-providers', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const providers = db.prepare('SELECT * FROM llm_providers ORDER BY priority ASC, created_at ASC').all() as any[];
  // 脱敏 api_key（L1: 短 key 防重叠，长度<=8 只显示前2位+**）
  const masked = providers.map((p) => {
    const k = p.api_key || '';
    let maskedKey = '';
    if (k.length > 8) {
      maskedKey = `${k.slice(0, 4)}****${k.slice(-4)}`;
    } else if (k.length > 2) {
      maskedKey = `${k.slice(0, 2)}**`;
    } else {
      maskedKey = k ? '**' : '';
    }
    return { ...p, api_key: maskedKey };
  });
  res.json({ providers: masked, mode: getLlmMode() });
});

// 创建 provider
router.post('/llm-providers', (req: AuthRequest, res: Response) => {
  try {
    const { name, baseUrl, apiKey, model, priority, maxConcurrency, isActive } = req.body;
    if (!name || !baseUrl || !apiKey || !model) {
      res.status(400).json({ error: 'name/baseUrl/apiKey/model 必填' });
      return;
    }
    const db = getDb();
    const id = generateId('llm');
    const now = Date.now();
    db.prepare(`
      INSERT INTO llm_providers (id, name, base_url, api_key, model, priority, is_active, max_concurrency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, baseUrl, apiKey, model,
      typeof priority === 'number' ? priority : 1,
      isActive === false ? 0 : 1,
      typeof maxConcurrency === 'number' ? maxConcurrency : 5,
      now, now,
    );

    db.prepare(`
      INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, detail, created_at)
      VALUES (?, ?, 'create_llm_provider', 'llm_provider', ?, ?, ?)
    `).run(generateId('log'), req.userId, id, JSON.stringify({ name, baseUrl, model, priority }), now);

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: '创建 LLM provider 失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// 更新 provider
router.patch('/llm-providers/:id', (req: AuthRequest, res: Response) => {
  try {
    const { name, baseUrl, apiKey, model, priority, maxConcurrency, isActive } = req.body;
    const db = getDb();
    const now = Date.now();

    const updates: string[] = [];
    const params: any[] = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (baseUrl !== undefined) { updates.push('base_url = ?'); params.push(baseUrl); }
    if (apiKey !== undefined) { updates.push('api_key = ?'); params.push(apiKey); }
    if (model !== undefined) { updates.push('model = ?'); params.push(model); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
    if (maxConcurrency !== undefined) { updates.push('max_concurrency = ?'); params.push(maxConcurrency); }
    if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive ? 1 : 0); }
    if (updates.length === 0) {
      res.status(400).json({ error: '没有要更新的字段' });
      return;
    }
    updates.push('updated_at = ?'); params.push(now);
    params.push(req.params.id);

    db.prepare(`UPDATE llm_providers SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    db.prepare(`
      INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, detail, created_at)
      VALUES (?, ?, 'update_llm_provider', 'llm_provider', ?, ?, ?)
    `).run(generateId('log'), req.userId, req.params.id, JSON.stringify(req.body), now);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '更新 LLM provider 失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// 删除 provider
router.delete('/llm-providers/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM llm_providers WHERE id = ?').run(req.params.id);

  db.prepare(`
    INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, detail, created_at)
    VALUES (?, ?, 'delete_llm_provider', 'llm_provider', ?, ?, ?)
  `).run(generateId('log'), req.userId, req.params.id, '', Date.now());

  res.json({ success: true });
});

// 切换模式（failover / loadbalance）
router.post('/llm-mode', (req: AuthRequest, res: Response) => {
  try {
    const { mode } = req.body as { mode: LlmMode };
    if (!['failover', 'loadbalance'].includes(mode)) {
      res.status(400).json({ error: 'mode 必须是 failover 或 loadbalance' });
      return;
    }
    setLlmMode(mode);
    const db = getDb();
    db.prepare(`
      INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, detail, created_at)
      VALUES (?, ?, 'update_llm_mode', 'settings', 'llm_mode', ?, ?)
    `).run(generateId('log'), req.userId, JSON.stringify({ mode }), Date.now());

    res.json({ success: true, mode });
  } catch (err) {
    res.status(500).json({ error: '切换模式失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// 重置 provider 故障状态（手动恢复）
router.post('/llm-providers/:id/reset', (req: AuthRequest, res: Response) => {
  const db = getDb();
  db.prepare(`
    UPDATE llm_providers SET fail_count = 0, cooldown_until = 0, last_error = NULL, updated_at = ?
    WHERE id = ?
  `).run(Date.now(), req.params.id);
  res.json({ success: true });
});

// 测试 provider 连接
router.post('/llm-providers/:id/test', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const p = db.prepare('SELECT * FROM llm_providers WHERE id = ?').get(req.params.id) as any;
    if (!p) {
      res.status(404).json({ error: 'provider 不存在' });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const startTs = Date.now();
    try {
      const r = await fetch(`${p.base_url.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.api_key}` },
        body: JSON.stringify({
          model: p.model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        }),
        signal: controller.signal,
      });
      const elapsed = Date.now() - startTs;
      if (r.ok) {
        res.json({ success: true, elapsed, status: r.status });
      } else {
        const text = await r.text().catch(() => '');
        res.json({ success: false, elapsed, status: r.status, error: text.slice(0, 200) });
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    res.status(500).json({ error: '测试失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// === 数据库备份 ===

// 手动备份
router.post('/backup', (req: AuthRequest, res: Response) => {
  try {
    if (!fs.existsSync(config.backupDir)) {
      fs.mkdirSync(config.backupDir, { recursive: true });
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(config.backupDir, `backup-${ts}.db`);
    
    // 使用 SQLite 的 backup API
    const db = getDb();
    db.backup(backupPath);
    
    res.json({ success: true, path: backupPath, size: fs.statSync(backupPath).size });
  } catch (err) {
    res.status(500).json({ error: '备份失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// 备份列表
router.get('/backups', (req: AuthRequest, res: Response) => {
  try {
    if (!fs.existsSync(config.backupDir)) {
      res.json({ backups: [] });
      return;
    }
    const files = fs.readdirSync(config.backupDir)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const fp = path.join(config.backupDir, f);
        const stat = fs.statSync(fp);
        return { name: f, size: stat.size, createdAt: stat.mtimeMs };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
    res.json({ backups: files });
  } catch (err) {
    res.status(500).json({ error: '获取备份列表失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// === 系统信息 ===

// 硬盘容量
// 获取磁盘容量信息（跨平台）
function getDiskInfo(dbPath: string): { total: number; used: number; free: number; drive: string } {
  try {
    const absPath = path.resolve(dbPath);
    const drive = process.platform === 'win32' ? absPath.substring(0, 2) : '/';

    if (process.platform === 'win32') {
      // Windows: 用 wmic 获取磁盘容量
      const output = execSync(`wmic logicaldisk where "DeviceID='${drive}'" get FreeSpace,Size /format:value`, {
        encoding: 'utf8',
        timeout: 5000,
      });
      let free = 0;
      let total = 0;
      for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('FreeSpace=')) free = parseInt(trimmed.split('=')[1] || '0', 10);
        if (trimmed.startsWith('Size=')) total = parseInt(trimmed.split('=')[1] || '0', 10);
      }
      return { total, used: total - free, free, drive };
    } else {
      // Linux/Mac: 用 df 获取磁盘容量
      const output = execSync(`df -k "${absPath}"`, { encoding: 'utf8', timeout: 5000 });
      const lines = output.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        const total = parseInt(parts[1], 10) * 1024;
        const used = parseInt(parts[2], 10) * 1024;
        const free = parseInt(parts[3], 10) * 1024;
        return { total, used, free, drive: parts[5] || '/' };
      }
    }
  } catch {
    // 忽略错误，返回 0
  }
  return { total: 0, used: 0, free: 0, drive: '' };
}

router.get('/system/disk', (req: AuthRequest, res: Response) => {
  try {
    const stats = fs.statSync(config.dbPath);
    const dbSize = stats.size;

    const disk = getDiskInfo(config.dbPath);
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    res.json({
      dbSize,
      dbPath: config.dbPath,
      backupDir: config.backupDir,
      // 硬盘容量（用户要求：总容量、已占用、未使用）
      disk: {
        total: disk.total,
        used: disk.used,
        free: disk.free,
        usedPercent: disk.total > 0 ? Math.round((disk.used / disk.total) * 100) : 0,
        drive: disk.drive,
      },
      // 内存信息（作为参考）
      totalMemory: totalMem,
      freeMemory: freeMem,
      usedMemory: totalMem - freeMem,
      memoryUsagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    });
  } catch (err) {
    res.status(500).json({ error: '获取系统信息失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// 在线用户
router.get('/system/online-users', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const now = Date.now();
  // 清理过期会话
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  
  const onlineCount = (db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM sessions WHERE expires_at > ?').get(now) as any).count;
  const onlineUsers = db.prepare(`
    SELECT u.id, u.username, u.nickname, u.avatar, MAX(s.created_at) as last_active
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.expires_at > ?
    GROUP BY u.id
    ORDER BY last_active DESC
  `).all(now);
  
  res.json({ onlineCount, onlineUsers });
});

// === 系统状态 ===
// 返回各子系统状态：已上线绿色✓，未上线灰色占位
router.get('/system/status', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const now = Date.now();

  // 1. 系统运行状态：进程运行时间
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();

  // 2. 数据库状态：尝试简单查询
  let dbStatus: { online: boolean; latency?: number; error?: string } = { online: false };
  try {
    const start = Date.now();
    db.prepare('SELECT 1').get();
    dbStatus = { online: true, latency: Date.now() - start };
  } catch (err) {
    dbStatus = { online: false, error: (err as Error).message };
  }

  // 3. LLM 状态：检查 provider 配置
  let llmStatus: { online: boolean; providerCount: number; activeCount: number; healthyCount: number; mode: string } = {
    online: false, providerCount: 0, activeCount: 0, healthyCount: 0, mode: 'failover',
  };
  try {
    const providers = db.prepare('SELECT is_active, cooldown_until, fail_count FROM llm_providers').all() as any[];
    const activeProviders = providers.filter((p) => p.is_active === 1);
    const healthyProviders = activeProviders.filter((p) => p.cooldown_until < now && p.fail_count < 3);
    llmStatus = {
      online: healthyProviders.length > 0,
      providerCount: providers.length,
      activeCount: activeProviders.length,
      healthyCount: healthyProviders.length,
      mode: getLlmMode(),
    };
  } catch {
    // llm_providers 表可能不存在（旧版），降级
    llmStatus = { online: false, providerCount: 0, activeCount: 0, healthyCount: 0, mode: 'failover' };
  }

  // 4. 在线用户数
  let onlineCount = 0;
  try {
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
    onlineCount = (db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM sessions WHERE expires_at > ?').get(now) as any).count;
  } catch {
    // ignore
  }

  res.json({
    // 已上线
    system: {
      online: true,
      uptime,
      memoryUsed: memUsage.rss,
      memoryTotal: os.totalmem(),
      nodeVersion: process.version,
    },
    database: dbStatus,
    backend: { online: true, port: config.port },
    api: { online: true, onlineUsers: onlineCount },
    llm: llmStatus,
    // 未上线（灰色占位）
    frontend: { online: true, note: '本地开发模式' },
    payment: { online: false, note: '支付接口未上线' },
    email: { online: false, note: '邮件服务未上线' },
    storage: { online: false, note: '对象存储未上线' },
    push: { online: false, note: '推送服务未上线' },
    timestamp: now,
  });
});

// 管理员操作日志
router.get('/logs', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 50);
  const offset = (page - 1) * pageSize;
  
  const total = (db.prepare('SELECT COUNT(*) as count FROM admin_logs').get() as any).count;
  const logs = db.prepare(`
    SELECT l.*, u.username as admin_username
    FROM admin_logs l LEFT JOIN users u ON l.admin_id = u.id
    ORDER BY l.created_at DESC LIMIT ? OFFSET ?
  `).all(pageSize, offset);
  
  res.json({ logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

// === 数据统计 ===

// 仪表盘统计数据
router.get('/dashboard', (req: AuthRequest, res: Response) => {
  const db = getDb();
  
  const totalUsers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE status != 'deleted'").get() as any).count;
  const activeUsers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active'").get() as any).count;
  const frozenUsers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'frozen'").get() as any).count;
  const todayNewUsers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE created_at > ?").get(Date.now() - 86400000) as any).count;
  const totalSessions = (db.prepare('SELECT COUNT(*) as count FROM learn_sessions').get() as any).count;
  const todaySessions = (db.prepare('SELECT COUNT(*) as count FROM learn_sessions WHERE created_at > ?').get(Date.now() - 86400000) as any).count;
  const totalStars = (db.prepare('SELECT COALESCE(SUM(total_stars), 0) as sum FROM users WHERE status != ?').get('deleted') as any).sum;
  
  res.json({
    users: { total: totalUsers, active: activeUsers, frozen: frozenUsers, todayNew: todayNewUsers },
    sessions: { total: totalSessions, today: todaySessions },
    totalStars,
  });
});

export default router;
