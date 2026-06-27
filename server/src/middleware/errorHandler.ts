import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err.message);
  // 生产环境不返回 detail，防止泄露 SQL 表名/列名/文件路径等内部信息
  const body: { error: string; detail?: string } = { error: '服务器内部错误' };
  if (!config.isProd) body.detail = err.message;
  res.status(500).json(body);
}
