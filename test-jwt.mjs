import jwt from 'jsonwebtoken';
const t = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1X21xb3phaHNoaHc2a2xuIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzgyMTM5MTYwLCJleHAiOjE3ODI3NDM5NjB9.oD5Q92WNlRU5hPtCtxH7-mXUmzeUlKMJuELyaLEmzjM';
try {
  const p = jwt.verify(t, 'yingyu-prod-jwt-secret-2026-random-x9k2m');
  console.log('VALID:', JSON.stringify(p));
} catch (e) {
  console.log('INVALID:', e.message);
}
