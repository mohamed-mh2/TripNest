// استعلامات PostgreSQL المعلّمة المعاملات والمعاملات الذرية المطلوبة لـ التسجيل والدخول وbcrypt وJWT وصلاحيات الحسابات؛ دون كود HTTP. المسؤول: madin abed.
// #explain_notes: Minimal placeholder used by the development-only demo session. Registration,
// passwords (bcrypt), and JWT remain madin abed's work.

const db = require('../db');


async function findUserById(userId) {
  const { rows } = await db.query(
    'SELECT id, full_name, email, role FROM users WHERE id = $1',
    [userId],
  );

  return rows[0] || null;
}


async function listDemoUsers() {
  const { rows } = await db.query(
    'SELECT id, full_name, role FROM users ORDER BY id ASC',
  );

  return rows;
}


module.exports = {
  findUserById,
  listDemoUsers,
};
