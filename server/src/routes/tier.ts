import { Router, Response } from 'express';
import { getDb } from '../db/index.js';
import { authRequired, adminRequired, AuthRequest } from '../middleware/auth.js';
import { TIER_CONFIGS, Tier, getCurrentPeriod } from '../config/tiers.js';
import { generateId } from '../utils/crypto.js';

const router = Router();

// 获取当前用户的等级信息 + 生成额度
router.get('/me', authRequired, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT tier, tier_expire_at, monthly_gen_count, monthly_gen_period, total_gen_count, total_stars FROM users WHERE id = ?').get(req.userId) as any;
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    const tier = (user.tier || 'free') as Tier;
    const cfg = TIER_CONFIGS[tier];
    const currentPeriod = getCurrentPeriod();

    // 懒重置月度计数：如果跨月了，重置
    let monthlyGenCount = user.monthly_gen_count || 0;
    if (user.monthly_gen_period !== currentPeriod) {
      monthlyGenCount = 0;
      db.prepare('UPDATE users SET monthly_gen_count = 0, monthly_gen_period = ? WHERE id = ?').run(currentPeriod, req.userId);
    }

    const totalGenCount = user.total_gen_count || 0;
    const monthlyLimit = cfg.monthlyGenLimit; // 0 = 无限制
    const totalLimit = cfg.totalGenLimit; // 0 = 无限制

    // 判断是否可生成
    let canGenerate = true;
    if (totalLimit > 0 && totalGenCount >= totalLimit) canGenerate = false;
    if (monthlyLimit > 0 && monthlyGenCount >= monthlyLimit) canGenerate = false;

    res.json({
      tier,
      tierName: cfg.nameZh,
      tierBadge: cfg.badge,
      tierExpireAt: user.tier_expire_at || null,
      monthlyGenCount,
      monthlyGenLimit: monthlyLimit,
      totalGenCount,
      totalGenLimit: totalLimit,
      canGenerate,
      canEnrichDialogue: cfg.canEnrichDialogue,
      canRedeemRewards: cfg.canRedeemRewards,
      maxRoutes: cfg.maxRoutes,
      totalStars: user.total_stars || 0,
    });
  } catch (err) {
    res.status(500).json({ error: '获取等级信息失败', detail: (err as Error).message });
  }
});

// 增加生成次数（场景生成成功后调用）
router.post('/incr-gen', authRequired, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT tier, monthly_gen_count, monthly_gen_period, total_gen_count FROM users WHERE id = ?').get(req.userId) as any;
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    const tier = (user.tier || 'free') as Tier;
    const cfg = TIER_CONFIGS[tier];
    const currentPeriod = getCurrentPeriod();

    // 跨月重置
    let monthlyCount = user.monthly_gen_count || 0;
    if (user.monthly_gen_period !== currentPeriod) {
      monthlyCount = 0;
    }

    // 检查是否超限
    const totalLimit = cfg.totalGenLimit;
    const monthlyLimit = cfg.monthlyGenLimit;
    if (totalLimit > 0 && (user.total_gen_count || 0) >= totalLimit) {
      res.status(403).json({ error: '已达到免费生成上限，升级 Plus/Pro 获取更多次数', code: 'LIMIT_EXCEEDED' });
      return;
    }
    if (monthlyLimit > 0 && monthlyCount >= monthlyLimit) {
      res.status(403).json({ error: `本月生成次数已用完（${monthlyLimit} 次/月），下月 1 号重置`, code: 'LIMIT_EXCEEDED' });
      return;
    }

    const newMonthly = monthlyCount + 1;
    const newTotal = (user.total_gen_count || 0) + 1;
    db.prepare('UPDATE users SET monthly_gen_count = ?, monthly_gen_period = ?, total_gen_count = ?, updated_at = ? WHERE id = ?')
      .run(newMonthly, currentPeriod, newTotal, Date.now(), req.userId);

    res.json({
      success: true,
      monthlyGenCount: newMonthly,
      monthlyGenLimit: monthlyLimit,
      totalGenCount: newTotal,
      totalGenLimit: totalLimit,
      remaining: monthlyLimit > 0 ? Math.max(0, monthlyLimit - newMonthly) : (totalLimit > 0 ? Math.max(0, totalLimit - newTotal) : -1),
    });
  } catch (err) {
    res.status(500).json({ error: '增加生成次数失败', detail: (err as Error).message });
  }
});

// 升级等级（占位：未来接入支付，当前仅管理员可手动调整）
router.post('/upgrade', adminRequired, (req: AuthRequest, res: Response) => {
  try {
    const { tier, durationDays } = req.body;
    if (!['plus', 'pro'].includes(tier)) {
      res.status(400).json({ error: '无效的等级' });
      return;
    }
    const db = getDb();
    const days = Number(durationDays) || 30;
    const expireAt = Date.now() + days * 86400000;
    // 同步 vip_level 兼容旧字段
    const vipLevel = tier === 'pro' ? 2 : 1;
    db.prepare('UPDATE users SET tier = ?, tier_expire_at = ?, vip_level = ?, vip_expire_at = ?, updated_at = ? WHERE id = ?')
      .run(tier, expireAt, vipLevel, expireAt, Date.now(), req.userId);

    res.json({
      success: true,
      tier,
      tierExpireAt: expireAt,
      message: `已升级为 ${TIER_CONFIGS[tier as Tier].nameZh}，有效期 ${days} 天`,
    });
  } catch (err) {
    res.status(500).json({ error: '升级失败', detail: (err as Error).message });
  }
});

// 降级回 free（管理员或过期触发）
router.post('/downgrade', authRequired, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    db.prepare('UPDATE users SET tier = ?, tier_expire_at = NULL, vip_level = 0, vip_expire_at = NULL, updated_at = ? WHERE id = ?')
      .run('free', Date.now(), req.userId);
    res.json({ success: true, tier: 'free' });
  } catch (err) {
    res.status(500).json({ error: '降级失败', detail: (err as Error).message });
  }
});

// 获取所有等级配置（定价页用）
router.get('/configs', (_req, res: Response) => {
  res.json({
    tiers: Object.values(TIER_CONFIGS),
    order: ['free', 'plus', 'pro'],
  });
});

export default router;
