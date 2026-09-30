const { db } = require('../db');
const AppError = require('../errors/app-error');

function getMe(req, res) {
  const user = db.prepare('SELECT id, email, email_verified_at, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'User no longer exists');

  const profile = db.prepare('SELECT name, mobile, address, business_name AS businessName, updated_at FROM profiles WHERE user_id = ?').get(req.userId) || null;
  const tasks = db.prepare(`SELECT t.id, t.name, t.category, t.description
    FROM user_tasks ut JOIN tasks t ON t.id = ut.task_id
    WHERE ut.user_id = ? ORDER BY t.category, t.name`).all(req.userId);

  res.json({
    data: {
      user: { id: user.id, email: user.email, emailVerifiedAt: user.email_verified_at },
      profile,
      selectedTasks: tasks,
      setupComplete: Boolean(profile && tasks.length)
    }
  });
}

function updateProfile(req, res) {
  const { name, mobile, address, businessName } = req.body;
  db.prepare(`INSERT INTO profiles (user_id, name, mobile, address, business_name)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, mobile = excluded.mobile, address = excluded.address, business_name = excluded.business_name, updated_at = CURRENT_TIMESTAMP`)
    .run(req.userId, name, mobile, address, businessName || null);

  const profile = db.prepare('SELECT name, mobile, address, business_name AS businessName, updated_at FROM profiles WHERE user_id = ?').get(req.userId);
  res.json({ data: profile });
}

module.exports = { getMe, updateProfile };
