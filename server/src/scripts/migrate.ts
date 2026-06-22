import { getDb } from '../db/index.js';

// 迁移版本记录
const MIGRATIONS: { version: number; description: string; sql: string }[] = [
  // 示例：未来添加新字段的迁移
  // { version: 2, description: '添加用户偏好字段', sql: 'ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT "{}"' },
];

async function main() {
  const db = getDb();
  
  // 获取当前版本
  const row = db.prepare('SELECT MAX(version) as v FROM schema_versions').get() as any;
  const currentVersion = row?.v || 0;
  
  console.log(`当前数据库版本: ${currentVersion}`);
  
  const pending = MIGRATIONS.filter(m => m.version > currentVersion);
  if (pending.length === 0) {
    console.log('✅ 数据库已是最新版本');
    process.exit(0);
  }
  
  for (const m of pending) {
    console.log(`应用迁移 v${m.version}: ${m.description}`);
    db.exec(m.sql);
    db.prepare('INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)').run(m.version, Date.now());
    console.log(`✅ 迁移 v${m.version} 完成`);
  }
  
  console.log('✅ 所有迁移已完成');
  process.exit(0);
}

main().catch(err => {
  console.error('迁移失败:', err);
  process.exit(1);
});
