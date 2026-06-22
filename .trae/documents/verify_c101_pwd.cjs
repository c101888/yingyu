// 验证 c101 密码
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./data/app.db');

const passwords = ['c101', 'c101@qq.com', '123456', 'c101c101', 'password', 'admin123', 'Cao123321@'];

(async () => {
  try {
    const user = db.prepare('SELECT password_hash FROM users WHERE username = ?').get('c101');
    if (!user) {
      console.log('c101 not found');
      return;
    }
    console.log('hash:', user.password_hash);
    for (const pwd of passwords) {
      const match = await bcrypt.compare(pwd, user.password_hash);
      console.log(`password "${pwd}": ${match ? 'MATCH' : 'no'}`);
    }
  } catch (e) {
    console.log('ERR:', e.message);
  }
})();
