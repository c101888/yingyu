import { Router, Response } from 'express';
import { getDb } from '../db/index.js';
import { hashPassword, verifyPassword, signToken, generateId } from '../utils/crypto.js';
import { AuthRequest } from '../middleware/auth.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// 注册：账户 + 邮箱 + 密码 + 头像
router.post('/register', async (req, res: Response) => {
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
    res.status(500).json({ error: '注册失败', detail: (err as Error).message });
  }
});

// 登录：支持账户或邮箱 + 密码
router.post('/login', async (req, res: Response) => {
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
    res.status(500).json({ error: '登录失败', detail: (err as Error).message });
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
