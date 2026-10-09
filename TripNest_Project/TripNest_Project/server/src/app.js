// تهيئة خادم JavaScript باستخدام Node.js وExpress وربط REST routes وmiddleware ومعالج الأخطاء. المسؤول: madin abed.
// #explain_notes: Minimal wiring added by Student 2. Other teams mount their routers here
// (wallet, support...) when their features are implemented.

const express = require('express');

const authRoutes = require('./routes/auth');
const tripsRoutes = require('./routes/trips');
const bookingsRoutes = require('./routes/bookings');
const { notFoundHandler, errorHandler } = require('./middleware/errors');


function createApp() {
  const app = express();

  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/trips', tripsRoutes);
  app.use('/api', bookingsRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}


module.exports = { createApp };
