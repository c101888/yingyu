import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '7550', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: process.env.DB_PATH || './data/app.db',
  backupDir: process.env.BACKUP_DIR || './backups',
  defaultAdmin: {
    username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
    email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:7500',
  arkApiKey: process.env.ARK_API_KEY || '',
  arkBaseUrl: process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/coding/v3',
};

// L4: 兜底默认值启动警告（仅在非生产环境提示，生产环境用默认值属严重配置错误）
if (config.jwtSecret === 'dev-secret-change-me') {
  console.warn('⚠️  JWT_SECRET 未配置，使用默认值，仅限本地开发！生产环境必须在 .env 中设置');
}
if (config.defaultAdmin.password === 'admin123') {
  console.warn('⚠️  DEFAULT_ADMIN_PASSWORD 未配置，使用默认 admin123，仅限本地开发！');
}
