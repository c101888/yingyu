// 将本地 c101 账号同步到服务器数据库（保留密码 hash、tier、昵称等）
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./data/app.db');

const c101Data = {
  id: 'u_mqnwh39thsbduw',
  username: 'c101',
  email: 'c101@qq.com',
  password_hash: '$2a$10$okI.W9EN0agjifRelmU0yuvdkQLP6dfGX8hmVtbuhjlaWtObq0NNC',
  nickname: '牛魔王',
  avatar: '🦊',
  role: 'user',
  status: 'active',
  total_stars: 0,
  vip_level: 0,
  tier: 'pro',
  tier_expire_at: null,
  created_at: 1782053218001,
  updated_at: Date.now(),
  last_login_at: null,
};

try {
  // 先检查是否已存在
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('c101');
  if (existing) {
    console.log('c101 already exists, updating...');
    db.prepare(`UPDATE users SET
      email = ?,
      password_hash = ?,
      nickname = ?,
      avatar = ?,
      role = ?,
      status = ?,
      total_stars = ?,
      vip_level = ?,
      tier = ?,
      tier_expire_at = ?,
      updated_at = ?
      WHERE username = ?`).run(
      c101Data.email, c101Data.password_hash, c101Data.nickname, c101Data.avatar,
      c101Data.role, c101Data.status, c101Data.total_stars, c101Data.vip_level,
      c101Data.tier, c101Data.tier_expire_at, c101Data.updated_at, c101Data.username
    );
    console.log('c101 updated successfully');
  } else {
    console.log('c101 not found, inserting...');
    db.prepare(`INSERT INTO users (id, username, email, password_hash, nickname, avatar, role, status, total_stars, vip_level, tier, tier_expire_at, created_at, updated_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      c101Data.id, c101Data.username, c101Data.email, c101Data.password_hash,
      c101Data.nickname, c101Data.avatar, c101Data.role, c101Data.status,
      c101Data.total_stars, c101Data.vip_level, c101Data.tier, c101Data.tier_expire_at,
      c101Data.created_at, c101Data.updated_at, c101Data.last_login_at
    );
    console.log('c101 inserted successfully');
  }

  // 验证
  const verify = db.prepare('SELECT id, username, email, status, tier, nickname FROM users WHERE username = ?').get('c101');
  console.log('VERIFY:', JSON.stringify(verify, null, 2));
} catch (e) {
  console.log('ERR:', e.message);
}
