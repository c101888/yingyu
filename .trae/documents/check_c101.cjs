const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./data/app.db');

try {
  const rows = db.prepare('SELECT id, username, email, status, password_hash, nickname, tier FROM users WHERE username = ? OR username = ?').all('c101', 'c102');
  console.log('USERS FOUND:', rows.length);
  for (const u of rows) {
    console.log('---');
    console.log('id:', u.id);
    console.log('username:', u.username);
    console.log('email:', u.email);
    console.log('status:', u.status);
    console.log('tier:', u.tier);
    console.log('nickname:', u.nickname);
    console.log('password_hash (first 30):', String(u.password_hash).substring(0, 30));
    console.log('password_hash length:', String(u.password_hash).length);
  }
} catch (e) {
  console.log('ERR:', e.message);
}
