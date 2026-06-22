import { Router, Response } from 'express';
import { getDb } from '../db/index.js';
import { generateId } from '../utils/crypto.js';
import { authRequired, AuthRequest } from '../middleware/auth.js';

const router = Router();

// 创建学习会话
router.post('/', authRequired, (req: AuthRequest, res: Response) => {
  try {
    const { sceneInput, sceneNameZh, sceneNameEn, source, difficulty, content } = req.body;
    if (!sceneInput || !content) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }
    
    const db = getDb();
    const id = generateId('s');
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO learn_sessions (id, user_id, scene_input, scene_name_zh, scene_name_en, source, difficulty, content_json, learned_done, practice_done, practice_round, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
    `).run(id, req.userId, sceneInput, sceneNameZh || '', sceneNameEn || '', source || 'input', difficulty || 'easy', JSON.stringify(content), now, now);
    
    res.json({ id, createdAt: now });
  } catch (err) {
    res.status(500).json({ error: '创建会话失败', detail: (err as Error).message });
  }
});

// 更新会话状态
router.patch('/:id', authRequired, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { learnedDone, practiceDone, practiceRound } = req.body;
    
    const db = getDb();
    const session = db.prepare('SELECT * FROM learn_sessions WHERE id = ? AND user_id = ?').get(id, req.userId) as any;
    if (!session) {
      res.status(404).json({ error: '会话不存在' });
      return;
    }
    
    const now = Date.now();
    db.prepare(`
      UPDATE learn_sessions 
      SET learned_done = ?, practice_done = ?, practice_round = ?, updated_at = ?
      WHERE id = ?
    `).run(
      learnedDone !== undefined ? (learnedDone ? 1 : 0) : session.learned_done,
      practiceDone !== undefined ? (practiceDone ? 1 : 0) : session.practice_done,
      practiceRound !== undefined ? practiceRound : session.practice_round,
      now, id
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '更新会话失败', detail: (err as Error).message });
  }
});

// 查询当前用户的学习历史
router.get('/', authRequired, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(50, parseInt(req.query.pageSize as string) || 20);
  const offset = (page - 1) * pageSize;
  
  const total = (db.prepare('SELECT COUNT(*) as count FROM learn_sessions WHERE user_id = ?').get(req.userId) as any).count;
  const sessions = db.prepare(`
    SELECT * FROM learn_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(req.userId, pageSize, offset);
  
  res.json({
    sessions: sessions.map((s: any) => ({
      ...s,
      content: JSON.parse(s.content_json),
      learnedDone: !!s.learned_done,
      practiceDone: !!s.practice_done,
    })),
    total, page, pageSize, totalPages: Math.ceil(total / pageSize),
  });
});

// 获取单个会话详情
router.get('/:id', authRequired, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM learn_sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as any;
  if (!session) {
    res.status(404).json({ error: '会话不存在' });
    return;
  }
  res.json({
    ...session,
    content: JSON.parse(session.content_json),
    learnedDone: !!session.learned_done,
    practiceDone: !!session.practice_done,
  });
});

export default router;
