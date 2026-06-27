import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { hashPassword, verifyPassword, signToken, generateId } from '../utils/crypto.js';
import { AuthRequest } from '../middleware/auth.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// M3 限流：登录每 IP 每 15 分钟 10 次，注册每 IP 每小时 5 次
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '登录尝试过于频繁，请 15 分钟后再试' },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '注册请求过于频繁，请 1 小时后再试' },
});

// JWT 有效期对应的毫秒数（用于 sessions 表 expires_at，与 token 过期保持一致）
const JWT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// 注册：账户 + 邮箱 + 密码 + 头像
router.post('/register', registerLimiter, async (req, res: Response) => {
  try {
    const { username, email, password, nickname, avatar } = req.body;
    if (!username || !email || !password) {
      res.status(400).json({ error: '账户、邮箱、密码不能为空' });
      return;
    }
    // 账户名：仅英文/数字，4-20 位
    if (!/^[a-zA-Z0-9]{4,20}$/.test(username)) {
      res.status(400).json({ error: '账户名只能用英文或数字，4-20 位' });
      return;
    }
    // 邮箱格式
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: '邮箱格式不正确' });
      return;
    }
    // 密码：6-32 位
    if (password.length < 6 || password.length > 32) {
      res.status(400).json({ error: '密码需 6-32 位' });
      return;
    }
    // 昵称：2-12 个字符（中英文数字均可）
    const finalNickname = nickname || username;
    if (finalNickname.length < 2 || finalNickname.length > 12) {
      res.status(400).json({ error: '昵称需 2-12 个字符' });
      return;
    }

    const db = getDb();
    // 检查账户和邮箱是否已存在
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) {
      res.status(409).json({ error: '账户或邮箱已被注册' });
      return;
    }

    // 头像校验：在预设头像库内
    const VALID_AVATARS = [
      '🦊', '🐻', '🐼', '🐨', '🐰', '🐯', '🦁', '🐮',
      '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦄', '🐶',
      '🍎', '🍓', '🍌', '🍉', '🍇', '🥕', '🌽', '🍔',
      '🌟', '🌙', '☀️', '🌈', '🌸', '🍀', '🌳', '⚡',
    ];
    const finalAvatar = avatar && VALID_AVATARS.includes(avatar) ? avatar : '🦊';

    const now = Date.now();
    const userId = generateId('u');
    const passwordHash = await hashPassword(password);

    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, nickname, avatar, role, status, total_stars, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'user', 'active', 0, ?, ?)
    `).run(userId, username, email, passwordHash, finalNickname, finalAvatar, now, now);

    const token = signToken({ userId, role: 'user' });
    res.json({
      token,
      user: { id: userId, username, email, nickname: finalNickname, avatar: finalAvatar, role: 'user', totalStars: 0, tier: 'free', tierExpireAt: null }
    });
  } catch (err) {
    res.status(500).json({ error: '注册失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// 登录：支持账户或邮箱 + 密码
router.post('/login', loginLimiter, async (req, res: Response) => {
  try {
    const { account, password } = req.body;
    if (!account || !password) {
      res.status(400).json({ error: '账户和密码不能为空' });
      return;
    }
    
    const db = getDb();
    // 支持账户或邮箱登录
    const user = db.prepare('SELECT * FROM users WHERE (username = ? OR email = ?) AND status != ?').get(account, account, 'deleted') as any;
    if (!user) {
      res.status(401).json({ error: '账户或密码错误' });
      return;
    }
    if (user.status === 'frozen') {
      res.status(403).json({ error: '账号已被冻结，请联系管理员' });
      return;
    }
    
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: '账户或密码错误' });
      return;
    }
    
    // 更新最后登录时间
    db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(Date.now(), Date.now(), user.id);

    // M1: 写入 sessions 表用于在线用户统计（先删该用户旧 session 避免堆积）
    const now = Date.now();
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    db.prepare('INSERT INTO sessions (id, user_id, token_hash, ip, user_agent, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(generateId('sess'), user.id, generateId('th'), req.ip || '', req.headers['user-agent'] || '', now, now + JWT_TTL_MS);

    const token = signToken({ userId: user.id, role: user.role });
    res.json({
      token,
      user: {
        id: user.id, username: user.username, email: user.email,
        nickname: user.nickname, avatar: user.avatar, role: user.role,
        totalStars: user.total_stars, vipLevel: user.vip_level || 0,
        tier: user.tier || 'free', tierExpireAt: user.tier_expire_at || null,
      }
    });
  } catch (err) {
    res.status(500).json({ error: '登录失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// 获取当前用户信息
router.get('/me', authRequired, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || user.status === 'deleted') {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  res.json({
    id: user.id, username: user.username, email: user.email,
    nickname: user.nickname, avatar: user.avatar, role: user.role,
    totalStars: user.total_stars, vipLevel: user.vip_level || 0,
    tier: user.tier || 'free', tierExpireAt: user.tier_expire_at || null,
    createdAt: user.created_at, lastLoginAt: user.last_login_at,
  });
});

export default router;
