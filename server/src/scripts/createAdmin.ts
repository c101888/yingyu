import { getDb } from '../db/index.js';
import { hashPassword, generateId } from '../utils/crypto.js';
import { config } from '../config.js';

// 创建默认管理员（可被 index.ts 调用，也可作为脚本独立运行）
export async function createDefaultAdmin(): Promise<void> {
  const db = getDb();
  
  // 检查是否已有管理员
  const existing = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (existing) {
    console.log('管理员账号已存在，跳过创建');
    return;
  }
  
  const now = Date.now();
  const userId = generateId('u');
  const passwordHash = await hashPassword(config.defaultAdmin.password);
  
  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, nickname, avatar, role, status, total_stars, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, '👑', 'admin', 'active', 0, ?, ?)
  `).run(userId, config.defaultAdmin.username, config.defaultAdmin.email, passwordHash, config.defaultAdmin.username, now, now);
  
  console.log('✅ 默认管理员账号创建成功');
  console.log(`   账户: ${config.defaultAdmin.username}`);
  console.log(`   邮箱: ${config.defaultAdmin.email}`);
  console.log('   密码: 请查看 server/.env 中的 DEFAULT_ADMIN_PASSWORD');
  console.log('   ⚠️  请尽快登录修改密码！');
}

// 作为脚本直接运行时
const isDirectRun = process.argv[1]?.endsWith('createAdmin.ts') || process.argv[1]?.endsWith('createAdmin.js');
if (isDirectRun) {
  createDefaultAdmin().then(() => process.exit(0)).catch(err => {
    console.error('创建管理员失败:', err);
    process.exit(1);
  });
}
