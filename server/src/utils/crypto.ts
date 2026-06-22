import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

// 哈希密码
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// 验证密码
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// 生成 JWT
export function signToken(payload: { userId: string; role: string }): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any });
}

// 验证 JWT
export function verifyToken(token: string): { userId: string; role: string } | null {
  try {
    return jwt.verify(token, config.jwtSecret) as { userId: string; role: string };
  } catch {
    return null;
  }
}

// 生成随机 ID
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
