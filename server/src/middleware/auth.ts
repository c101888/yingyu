import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/crypto.js';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

// 普通用户认证
export function authRequired(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: '登录已过期，请重新登录' });
    return;
  }
  req.userId = payload.userId;
  req.userRole = payload.role;
  next();
}

// 管理员认证
export function adminRequired(req: AuthRequest, res: Response, next: NextFunction): void {
  authRequired(req, res, () => {
    if (req.userRole !== 'admin') {
      res.status(403).json({ error: '需要管理员权限' });
      return;
    }
    next();
  });
}
