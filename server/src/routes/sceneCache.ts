import { Router, Response } from 'express';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { authRequired, AuthRequest } from '../middleware/auth.js';

const router = Router();

// 归一化场景输入：trim + lowercase + 去除所有标点和空白
// 这样 "去吃饭" / " 去吃饭 " / "去吃饭。" / "去 吃 饭" 都会归一化为 "去吃饭"
// 必须一字不差（仅忽略大小写、首尾空格、标点）才命中
export function normalizeSceneInput(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    // 去除所有标点符号（中英文）
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

// GET /api/scene-cache?sceneInput=xxx&difficulty=yyy
// 查询缓存：命中则返回内容并增加 hit_count；未命中返回 404
router.get('/', authRequired, (req: AuthRequest, res: Response) => {
  try {
    const sceneInput = String(req.query.sceneInput || '');
    const difficulty = String(req.query.difficulty || 'easy');
    if (!sceneInput) {
      res.status(400).json({ error: '缺少 sceneInput' });
      return;
    }
    const cacheKey = normalizeSceneInput(sceneInput);
    if (!cacheKey) {
      res.status(404).json({ error: '场景输入无效' });
      return;
    }

    const db = getDb();
    const row = db.prepare(
      'SELECT * FROM scene_cache WHERE cache_key = ? AND difficulty = ?',
    ).get(cacheKey, difficulty) as
      | {
          cache_key: string;
          difficulty: string;
          scene_input: string;
          content_json: string;
          hit_count: number;
          created_by: string | null;
          created_at: number;
          last_hit_at: number | null;
        }
      | undefined;

    if (!row) {
      res.status(404).json({ error: '缓存未命中', hit: false });
      return;
    }

    // 增加命中次数
    const now = Date.now();
    db.prepare(
      'UPDATE scene_cache SET hit_count = hit_count + 1, last_hit_at = ? WHERE cache_key = ? AND difficulty = ?',
    ).run(now, cacheKey, difficulty);

    let content: unknown;
    try {
      content = JSON.parse(row.content_json);
    } catch {
      // 缓存内容损坏，删除并返回未命中
      db.prepare('DELETE FROM scene_cache WHERE cache_key = ? AND difficulty = ?').run(
        cacheKey,
        difficulty,
      );
      res.status(404).json({ error: '缓存内容损坏，已删除', hit: false });
      return;
    }

    res.json({
      hit: true,
      sceneInput: row.scene_input,
      difficulty: row.difficulty,
      content,
      createdAt: row.created_at,
      hitCount: row.hit_count + 1,
    });
  } catch (err) {
    res.status(500).json({ error: '查询缓存失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// POST /api/scene-cache
// 保存到缓存：仅当不存在时插入（INSERT OR IGNORE），第一个生成者胜出
router.post('/', authRequired, (req: AuthRequest, res: Response) => {
  try {
    const { sceneInput, difficulty, content } = req.body;
    if (!sceneInput || !content) {
      res.status(400).json({ error: '缺少 sceneInput 或 content' });
      return;
    }
    const cacheKey = normalizeSceneInput(sceneInput);
    if (!cacheKey) {
      res.status(400).json({ error: '场景输入无效' });
      return;
    }
    const diff = String(difficulty || 'easy');
    const now = Date.now();
    const db = getDb();

    // INSERT OR IGNORE：已存在则不覆盖（保留第一个生成者的内容）
    const result = db.prepare(
      `INSERT OR IGNORE INTO scene_cache (cache_key, difficulty, scene_input, content_json, hit_count, created_by, created_at, last_hit_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, NULL)`,
    ).run(cacheKey, diff, String(sceneInput).trim(), JSON.stringify(content), req.userId || null, now);

    res.json({
      saved: result.changes > 0,
      cacheKey,
      difficulty: diff,
    });
  } catch (err) {
    res.status(500).json({ error: '保存缓存失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// GET /api/scene-cache/stats
// 管理员统计：总缓存数、总命中数、命中率、热门场景 Top N
router.get('/stats', authRequired, (req: AuthRequest, res: Response) => {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: '需要管理员权限' });
    return;
  }
  try {
    const db = getDb();
    const totalRow = db.prepare(
      'SELECT COUNT(*) as total, COALESCE(SUM(hit_count), 0) as total_hits FROM scene_cache',
    ).get() as { total: number; total_hits: number };

    const topScenes = db.prepare(
      'SELECT scene_input, difficulty, hit_count, created_at, last_hit_at FROM scene_cache ORDER BY hit_count DESC LIMIT 20',
    ).all() as Array<{
      scene_input: string;
      difficulty: string;
      hit_count: number;
      created_at: number;
      last_hit_at: number | null;
    }>;

    const recentScenes = db.prepare(
      'SELECT scene_input, difficulty, hit_count, created_at, last_hit_at FROM scene_cache ORDER BY created_at DESC LIMIT 20',
    ).all() as Array<{
      scene_input: string;
      difficulty: string;
      hit_count: number;
      created_at: number;
      last_hit_at: number | null;
    }>;

    res.json({
      totalCached: totalRow.total,
      totalHits: totalRow.total_hits,
      topScenes: topScenes.map((s) => ({
        sceneInput: s.scene_input,
        difficulty: s.difficulty,
        hitCount: s.hit_count,
        createdAt: s.created_at,
        lastHitAt: s.last_hit_at,
      })),
      recentScenes: recentScenes.map((s) => ({
        sceneInput: s.scene_input,
        difficulty: s.difficulty,
        hitCount: s.hit_count,
        createdAt: s.created_at,
        lastHitAt: s.last_hit_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: '获取统计失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// DELETE /api/scene-cache
// 管理员清空缓存
router.delete('/', authRequired, (req: AuthRequest, res: Response) => {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: '需要管理员权限' });
    return;
  }
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM scene_cache').run();
    res.json({ deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: '清空缓存失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

export default router;
