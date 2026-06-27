import { Response } from 'express';
import { config } from '../config.js';

// 统一错误响应：生产环境隐藏 detail 防止泄露 SQL 表名/列名/文件路径等内部信息
export function apiError(res: Response, status: number, message: string, err?: unknown): void {
  const body: { error: string; detail?: string } = { error: message };
  if (!config.isProd && err !== undefined) {
    body.detail = err instanceof Error ? err.message : String(err);
  }
  res.status(status).json(body);
}
