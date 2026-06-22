// 数据库建表 SQL，使用 CREATE TABLE IF NOT EXISTS 保证幂等
// 所有表都包含 created_at 和 updated_at 时间戳，便于追踪
// 预留 VIP、支付等未来扩展字段

export const SCHEMA_SQL = `
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '🦊',
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'frozen', 'deleted')),
  total_stars INTEGER NOT NULL DEFAULT 0,
  -- 会员等级体系：free / plus / pro
  tier TEXT NOT NULL DEFAULT 'free' CHECK(tier IN ('free', 'plus', 'pro')),
  tier_expire_at INTEGER,
  -- 兼容旧字段（管理员后台仍可读写，但前端已切换到 tier）
  vip_level INTEGER NOT NULL DEFAULT 0,
  vip_expire_at INTEGER,
  -- 场景生成次数统计
  monthly_gen_count INTEGER NOT NULL DEFAULT 0,
  monthly_gen_period TEXT,
  total_gen_count INTEGER NOT NULL DEFAULT 0,
  -- 时间戳
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER
);

-- 积分记录表
CREATE TABLE IF NOT EXISTS point_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  scene_name_zh TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  stars INTEGER NOT NULL,
  earned_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_point_records_user_id ON point_records(user_id);
CREATE INDEX IF NOT EXISTS idx_point_records_session_id ON point_records(session_id);

-- 学习会话表
CREATE TABLE IF NOT EXISTS learn_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  scene_input TEXT NOT NULL,
  scene_name_zh TEXT NOT NULL,
  scene_name_en TEXT NOT NULL,
  source TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'easy',
  content_json TEXT NOT NULL,
  learned_done INTEGER NOT NULL DEFAULT 0,
  practice_done INTEGER NOT NULL DEFAULT 0,
  practice_round INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_learn_sessions_user_id ON learn_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_learn_sessions_created_at ON learn_sessions(created_at);

-- 系统设置表（存储 LLM 配置等）
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 支付订单表（预留未来在线支付）
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  order_no TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  product_type TEXT NOT NULL,
  product_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'cancelled', 'refunded')),
  paid_at INTEGER,
  -- 预留支付渠道字段
  payment_channel TEXT,
  payment_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- 在线会话表（用于在线用户统计）
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 数据库迁移版本表
CREATE TABLE IF NOT EXISTS schema_versions (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

-- 操作日志表（管理员操作记录）
CREATE TABLE IF NOT EXISTS admin_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);

-- 场景缓存表（所有用户共享，归一化匹配，节省 LLM 调用）
-- cache_key = 归一化后的场景输入（trim + lowercase + 去除标点和空白）
CREATE TABLE IF NOT EXISTS scene_cache (
  cache_key TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  scene_input TEXT NOT NULL,
  content_json TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  last_hit_at INTEGER,
  PRIMARY KEY (cache_key, difficulty)
);
CREATE INDEX IF NOT EXISTS idx_scene_cache_hit_count ON scene_cache(hit_count DESC);
CREATE INDEX IF NOT EXISTS idx_scene_cache_last_hit ON scene_cache(last_hit_at DESC);

-- 奖励表（Pro 专属功能：家长自定义奖励，孩子用星星兑换）
CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  star_cost INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT '🎁',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_preset INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rewards_user_id ON rewards(user_id);

-- 奖励兑换记录表
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reward_id TEXT,
  reward_name TEXT NOT NULL,
  stars_spent INTEGER NOT NULL,
  redeemed_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user_id ON reward_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_redeemed_at ON reward_redemptions(redeemed_at DESC);

-- LLM 多模型配置表（支持顺序轮切 / 并发分流两种模式）
-- mode 存在 settings 表 key='llm_mode'，值为 'failover' | 'loadbalance'
CREATE TABLE IF NOT EXISTS llm_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  model TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,        -- 优先级：1=主，2=次，3=最次...
  is_active INTEGER NOT NULL DEFAULT 1,        -- 是否启用 1/0
  max_concurrency INTEGER NOT NULL DEFAULT 5,  -- 最大并发数（loadbalance 模式用）
  -- 运行时状态（故障计数 + 冷却到期时间）
  fail_count INTEGER NOT NULL DEFAULT 0,
  cooldown_until INTEGER NOT NULL DEFAULT 0,   -- 0=未冷却；>0=冷却到该时间戳
  last_used_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_llm_providers_priority ON llm_providers(priority);
CREATE INDEX IF NOT EXISTS idx_llm_providers_active ON llm_providers(is_active);
`;
