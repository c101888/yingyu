import { Router, Response } from 'express';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { generateId } from '../utils/crypto.js';
import { authRequired, AuthRequest } from '../middleware/auth.js';

const router = Router();

// 发放积分（完成学习闭环时调用）
router.post('/award', authRequired, (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, sceneNameZh, difficulty } = req.body;
    if (!sessionId || !sceneNameZh || !difficulty) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }
    // difficulty 值域校验，防止传任意字符串骗取 30 分
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      res.status(400).json({ error: '无效的难度' });
      return;
    }

    const db = getDb();
    // 校验 sessionId 真实存在且归属当前用户，防止伪造 sessionId 刷分
    const session = db.prepare('SELECT id FROM learn_sessions WHERE id = ? AND user_id = ?').get(sessionId, req.userId);
    if (!session) {
      res.status(403).json({ error: '无效的学习会话' });
      return;
    }

    // 检查是否已发放
    const existing = db.prepare('SELECT id FROM point_records WHERE session_id = ?').get(sessionId);
    if (existing) {
      res.json({ stars: 0, message: '该场景已发放过积分' });
      return;
    }

    const stars = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 30;
    const recordId = generateId('p');
    const now = Date.now();
    
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO point_records (id, user_id, session_id, scene_name_zh, difficulty, stars, earned_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(recordId, req.userId, sessionId, sceneNameZh, difficulty, stars, now);
      
      db.prepare('UPDATE users SET total_stars = total_stars + ?, updated_at = ? WHERE id = ?')
        .run(stars, now, req.userId);
    });
    tx();
    
    res.json({ stars, recordId });
  } catch (err) {
    res.status(500).json({ error: '发放积分失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// 查询当前用户总积分
router.get('/total', authRequired, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT total_stars FROM users WHERE id = ?').get(req.userId) as any;
  res.json({ totalStars: user?.total_stars || 0 });
});

// 查询当前用户积分记录
router.get('/records', authRequired, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const records = db.prepare(`
    SELECT * FROM point_records WHERE user_id = ? ORDER BY earned_at DESC LIMIT ?
  `).all(req.userId, limit);
  res.json({ records });
});

export default router;
