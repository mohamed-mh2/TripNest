// Starts the Express server. Kept separate from app.js so tests can create the app without listening. المسؤول: الفريق.

const { createApp } = require('./app');


const port = Number(process.env.PORT) || 4000;

createApp().listen(port, () => {
  console.log(`TripNest API listening on http://localhost:${port}`);
});
