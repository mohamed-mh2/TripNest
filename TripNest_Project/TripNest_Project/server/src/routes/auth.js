// مسارات Express وطرق REST والتحقق من المدخلات واستدعاء وسيط المصادقة ثم controller الخاص بـ التسجيل والدخول وbcrypt وJWT وصلاحيات الحسابات. المسؤول: madin abed.
// #explain_notes: Placeholder added by Student 2. Only the development demo-session routes exist;
// registration and login (bcrypt + JWT) are still madin abed's work.

const express = require('express');

const { listDemoUsers } = require('../models/auth');
const { requireAuth, isDemoSessionAllowed } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../utils/httpError');


const router = express.Router();


router.get('/demo-users', asyncHandler(async (req, res) => {
  if (!isDemoSessionAllowed()) {
    throw new HttpError(404, 'The requested resource was not found.', { code: 'NOT_FOUND' });
  }

  const users = await listDemoUsers();

  res.json({
    isDemoSession: true,
    users: users.map((user) => ({ id: user.id, fullName: user.full_name, role: user.role })),
  });
}));


router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});


module.exports = router;
