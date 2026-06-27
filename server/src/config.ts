import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '7550', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
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
