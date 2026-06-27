import { Router, Response } from 'express';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { authRequired, AuthRequest } from '../middleware/auth.js';
import { generateId } from '../utils/crypto.js';
import { TIER_CONFIGS, Tier, PRESET_REWARDS } from '../config/tiers.js';

const router = Router();

// 确保用户有预设奖励（首次访问时种入）
function ensurePresetRewards(userId: string): void {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM rewards WHERE user_id = ?').get(userId) as any).c;
  if (count === 0) {
    const now = Date.now();
    const stmt = db.prepare(
      'INSERT INTO rewards (id, user_id, name, description, star_cost, icon, sort_order, is_preset, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
    );
    PRESET_REWARDS.forEach((r, i) => {
      stmt.run(generateId('rw'), userId, r.name, r.description, r.starCost, r.icon, i, now, now);
    });
  }
}

// 获取用户的奖励列表
router.get('/', authRequired, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT tier, total_stars FROM users WHERE id = ?').get(req.userId) as any;
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }
    const tier = (user.tier || 'free') as Tier;
    const canRedeem = TIER_CONFIGS[tier].canRedeemRewards;

    ensurePresetRewards(req.userId!);
    const rewards = db.prepare('SELECT * FROM rewards WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC').all(req.userId) as any[];
    res.json({
      rewards: rewards.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        starCost: r.star_cost,
        icon: r.icon,
        isPreset: !!r.is_preset,
        sortOrder: r.sort_order,
      })),
      totalStars: user.total_stars || 0,
      canRedeem,
    });
  } catch (err) {
    res.status(500).json({ error: '获取奖励失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// 创建奖励（家长操作，需 Pro）
router.post('/', authRequired, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT tier FROM users WHERE id = ?').get(req.userId) as any;
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }
    const tier = (user.tier || 'free') as Tier;
    if (!TIER_CONFIGS[tier].canRedeemRewards) {
      res.status(403).json({ error: '积分兑换奖励是 Pro 专属功能，请升级 Pro', code: 'PRO_REQUIRED' });
      return;
    }

    const { name, description, starCost, icon } = req.body;
    if (!name || !starCost || starCost < 1) {
      res.status(400).json({ error: '奖励名称和星数不能为空' });
      return;
    }
    const now = Date.now();
    const id = generateId('rw');
    const maxSort = (db.prepare('SELECT MAX(sort_order) as m FROM rewards WHERE user_id = ?').get(req.userId) as any).m || 0;
    db.prepare(
      'INSERT INTO rewards (id, user_id, name, description, star_cost, icon, sort_order, is_preset, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)',
    ).run(id, req.userId, String(name).slice(0, 50), String(description || '').slice(0, 200), Number(starCost), String(icon || '🎁').slice(0, 4), maxSort + 1, now, now);

    res.json({
      id,
      name: String(name).slice(0, 50),
      description: String(description || '').slice(0, 200),
      starCost: Number(starCost),
      icon: String(icon || '🎁').slice(0, 4),
      isPreset: false,
      sortOrder: maxSort + 1,
    });
  } catch (err) {
    res.status(500).json({ error: '创建奖励失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// 修改奖励（家长操作，需 Pro）
router.patch('/:id', authRequired, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT tier FROM users WHERE id = ?').get(req.userId) as any;
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }
    const tier = (user.tier || 'free') as Tier;
    if (!TIER_CONFIGS[tier].canRedeemRewards) {
      res.status(403).json({ error: 'Pro 专属功能', code: 'PRO_REQUIRED' });
      return;
    }

    const { id } = req.params;
    const reward = db.prepare('SELECT * FROM rewards WHERE id = ? AND user_id = ?').get(id, req.userId) as any;
    if (!reward) {
      res.status(404).json({ error: '奖励不存在' });
      return;
    }

    const { name, description, starCost, icon } = req.body;
    const now = Date.now();
    db.prepare('UPDATE rewards SET name = ?, description = ?, star_cost = ?, icon = ?, updated_at = ? WHERE id = ?')
      .run(
        name !== undefined ? String(name).slice(0, 50) : reward.name,
        description !== undefined ? String(description).slice(0, 200) : reward.description,
        starCost !== undefined ? Number(starCost) : reward.star_cost,
        icon !== undefined ? String(icon).slice(0, 4) : reward.icon,
        now, id,
      );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '修改奖励失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// 删除奖励（家长操作，需 Pro）
router.delete('/:id', authRequired, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT tier FROM users WHERE id = ?').get(req.userId) as any;
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }
    const tier = (user.tier || 'free') as Tier;
    if (!TIER_CONFIGS[tier].canRedeemRewards) {
      res.status(403).json({ error: 'Pro 专属功能', code: 'PRO_REQUIRED' });
      return;
    }

    const { id } = req.params;
    const result = db.prepare('DELETE FROM rewards WHERE id = ? AND user_id = ?').run(id, req.userId);
    if (result.changes === 0) {
      res.status(404).json({ error: '奖励不存在' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除奖励失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// 兑换奖励（扣星，需 Pro）
router.post('/:id/redeem', authRequired, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT tier, total_stars FROM users WHERE id = ?').get(req.userId) as any;
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }
    const tier = (user.tier || 'free') as Tier;
    if (!TIER_CONFIGS[tier].canRedeemRewards) {
      res.status(403).json({ error: '积分兑换奖励是 Pro 专属功能，请升级 Pro', code: 'PRO_REQUIRED' });
      return;
    }

    const { id } = req.params;
    const reward = db.prepare('SELECT * FROM rewards WHERE id = ? AND user_id = ?').get(id, req.userId) as any;
    if (!reward) {
      res.status(404).json({ error: '奖励不存在' });
      return;
    }

    const totalStars = user.total_stars || 0;
    if (totalStars < reward.star_cost) {
      res.status(400).json({ error: `星星不够，还需 ${reward.star_cost - totalStars} 颗`, code: 'NOT_ENOUGH_STARS' });
      return;
    }

    const now = Date.now();
    // 扣星 + 记录兑换
    const newTotal = totalStars - reward.star_cost;
    const tx = db.transaction(() => {
      db.prepare('UPDATE users SET total_stars = ?, updated_at = ? WHERE id = ?').run(newTotal, now, req.userId);
      db.prepare('INSERT INTO reward_redemptions (id, user_id, reward_id, reward_name, stars_spent, redeemed_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(generateId('rr'), req.userId, id, reward.name, reward.star_cost, now);
    });
    tx();

    res.json({
      success: true,
      rewardName: reward.name,
      starsSpent: reward.star_cost,
      totalStars: newTotal,
      message: `兑换成功！消耗 ${reward.star_cost}⭐`,
    });
  } catch (err) {
    res.status(500).json({ error: '兑换失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

// 兑换历史
router.get('/redemptions', authRequired, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const records = db.prepare('SELECT * FROM reward_redemptions WHERE user_id = ? ORDER BY redeemed_at DESC LIMIT ?').all(req.userId, limit) as any[];
    res.json({
      redemptions: records.map((r) => ({
        id: r.id,
        rewardName: r.reward_name,
        starsSpent: r.stars_spent,
        redeemedAt: r.redeemed_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: '获取兑换历史失败', detail: config.isProd ? undefined : (err as Error).message });
  }
});

export default router;
