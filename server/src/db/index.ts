import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { SCHEMA_SQL } from './schema.js';
import fs from 'fs';
import path from 'path';

// 包装 node:sqlite 的 DatabaseSync，提供与 better-sqlite3 兼容的 API
// 这样路由层代码无需修改即可切换到内置 SQLite
class DatabaseWrapper {
  private inner: DatabaseSync;
  readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.inner = new DatabaseSync(dbPath);
  }

  exec(sql: string): void {
    this.inner.exec(sql);
  }

  pragma(pragmaStr: string): void {
    // node:sqlite 没有 .pragma() 方法，用 exec 执行 PRAGMA 语句
    this.inner.exec(`PRAGMA ${pragmaStr}`);
  }

  prepare(sql: string): StatementWrapper {
    return new StatementWrapper(this.inner.prepare(sql));
  }

  transaction<T>(fn: () => T): () => T {
    // better-sqlite3 的 transaction 返回一个可调用函数，调用时才执行事务
    return () => {
      this.inner.exec('BEGIN');
      try {
        const result = fn();
        this.inner.exec('COMMIT');
        return result;
      } catch (err) {
        this.inner.exec('ROLLBACK');
        throw err;
      }
    };
  }

  backup(targetPath: string): void {
    // node:sqlite 没有内置 backup 方法，使用文件复制
    // 先确保所有写入落盘
    this.inner.exec('PRAGMA wal_checkpoint(FULL)');
    this.inner.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    // 复制数据库文件
    const sourcePath = this.dbPath;
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
    } else {
      throw new Error(`数据库文件不存在: ${sourcePath}`);
    }
  }

  close(): void {
    this.inner.close();
  }
}

class StatementWrapper {
  private stmt: ReturnType<DatabaseSync['prepare']>;

  constructor(stmt: ReturnType<DatabaseSync['prepare']>) {
    this.stmt = stmt;
  }

  get(...params: unknown[]): unknown {
    return this.stmt.get(...params as never[]);
  }

  all(...params: unknown[]): unknown[] {
    return this.stmt.all(...params as never[]);
  }

  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint } {
    return this.stmt.run(...params as never[]) as { changes: number; lastInsertRowid: number | bigint };
  }
}

let db: DatabaseWrapper | null = null;

export function getDb(): DatabaseWrapper {
  if (db) return db;

  // 确保数据目录存在
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new DatabaseWrapper(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 初始化 schema
  db.exec(SCHEMA_SQL);

  // 迁移：为旧数据库补充新增列（CREATE TABLE IF NOT EXISTS 不会添加新列）
  migrateUsersTable(db);

  // 种子：如果 llm_providers 表为空且环境变量有 ARK_API_KEY，自动插入火山引擎配置
  seedLlmProviders(db);

  return db;
}

// 种子 LLM providers：如果表为空且环境变量有 ARK_API_KEY，自动插入火山引擎配置
function seedLlmProviders(db: DatabaseWrapper): void {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM llm_providers').get() as { cnt: number };
  if (count.cnt > 0) return; // 已有配置，不覆盖

  const apiKey = config.arkApiKey;
  if (!apiKey) {
    console.log('⚠️ llm_providers 表为空且未配置 ARK_API_KEY 环境变量，请在后台手动添加 LLM 配置');
    return;
  }

  const now = Date.now();
  const id = 'volcengine-ark-default';
  db.prepare(`
    INSERT INTO llm_providers (id, name, base_url, api_key, model, priority, is_active, max_concurrency, fail_count, cooldown_until, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    '火山引擎 ARK',
    config.arkBaseUrl,
    apiKey,
    'glm-5.2',
    1,        // priority
    1,        // is_active
    5,        // max_concurrency
    0,        // fail_count
    0,        // cooldown_until
    now,      // created_at
    now,      // updated_at
  );
  console.log('✅ 已自动种子火山引擎 ARK LLM 配置（后台 /admin/llm 可查看和编辑）');
}

// users 表迁移：添加 tier 等新列（如果不存在）
function migrateUsersTable(db: DatabaseWrapper): void {
  const cols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));
  const migrations: Array<{ col: string; sql: string }> = [
    { col: 'tier', sql: "ALTER TABLE users ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'" },
    { col: 'tier_expire_at', sql: 'ALTER TABLE users ADD COLUMN tier_expire_at INTEGER' },
    { col: 'monthly_gen_count', sql: 'ALTER TABLE users ADD COLUMN monthly_gen_count INTEGER NOT NULL DEFAULT 0' },
    { col: 'monthly_gen_period', sql: 'ALTER TABLE users ADD COLUMN monthly_gen_period TEXT' },
    { col: 'total_gen_count', sql: 'ALTER TABLE users ADD COLUMN total_gen_count INTEGER NOT NULL DEFAULT 0' },
  ];
  for (const m of migrations) {
    if (!colNames.has(m.col)) {
      try {
        db.exec(m.sql);
        console.log(`✅ 迁移：users 表添加列 ${m.col}`);
      } catch (err) {
        console.error(`迁移失败 ${m.col}:`, err);
      }
    }
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
