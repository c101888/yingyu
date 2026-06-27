import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { getDb } from './db/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import pointsRoutes from './routes/points.js';
import sessionsRoutes from './routes/sessions.js';
import adminRoutes from './routes/admin.js';
import sceneCacheRoutes from './routes/sceneCache.js';
import tierRoutes from './routes/tier.js';
import rewardsRoutes from './routes/rewards.js';
import llmRoutes from './routes/llm.js';
import { createDefaultAdmin } from './scripts/createAdmin.js';
import cron from 'node-cron';
import fs from 'fs';

const app = express();

// 中间件
// CORS：用 config.corsOrigin 白名单收紧，避免 origin:true 反射任意源带凭证跨域
// Capacitor APK 的 origin 为 http://localhost，已在 corsOrigin 中放行
const allowedOrigins = config.corsOrigin.split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // 允许同源请求（origin 为 undefined，如 Capacitor/PWA 部分场景）和白名单内来源
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// 健康检查
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/scene-cache', sceneCacheRoutes);
app.use('/api/tier', tierRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/llm', llmRoutes);

// 错误处理
app.use(errorHandler);

// 启动服务器
async function start() {
  // 初始化数据库
  getDb();
  console.log('✅ 数据库已初始化');
  
  // 创建默认管理员
  await createDefaultAdmin();
  
  // 定时备份（每天凌晨 3 点）
  if (!fs.existsSync(config.backupDir)) {
    fs.mkdirSync(config.backupDir, { recursive: true });
  }
  cron.schedule('0 3 * * *', () => {
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${config.backupDir}/auto-backup-${ts}.db`;
      getDb().backup(backupPath);
      console.log(`✅ 自动备份完成: ${backupPath}`);
      
      // 清理 30 天前的自动备份
      const files = fs.readdirSync(config.backupDir).filter(f => f.startsWith('auto-backup-'));
      const now = Date.now();
      for (const f of files) {
        const fp = `${config.backupDir}/${f}`;
        const stat = fs.statSync(fp);
        if (now - stat.mtimeMs > 30 * 86400000) {
          fs.unlinkSync(fp);
          console.log(`🗑️  清理旧备份: ${f}`);
        }
      }
    } catch (err) {
      console.error('❌ 自动备份失败:', err);
    }
  });
  
  app.listen(config.port, () => {
    console.log(`🚀 后台服务已启动: http://localhost:${config.port}`);
    console.log(`   环境: ${config.nodeEnv}`);
    console.log(`   数据库: ${config.dbPath}`);
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
