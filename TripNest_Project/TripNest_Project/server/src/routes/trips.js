// مسارات Express وطرق REST والتحقق من المدخلات واستدعاء وسيط المصادقة ثم controller الخاص بـ إنشاء الرحلات وتعديلها وأرشفتها والتحقق من ملكية الرحلة. المسؤول: madin abed.
// #explain_notes: Read-only placeholder added by Student 2 so customers can pick a trip at checkout.
// Creating, editing, and archiving trips remain madin abed's work.

const express = require('express');

const { listTripsForUser } = require('../models/trips');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/httpError');
const { toDateString } = require('../utils/dates');


const router = express.Router();


router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const trips = await listTripsForUser(req.user.id);

  res.json({
    trips: trips.map((trip) => ({
      id: trip.id,
      title: trip.title,
      destinationCity: trip.destination_city,
      currency: trip.currency,
      startDate: toDateString(trip.start_date),
      endDate: toDateString(trip.end_date),
      status: trip.status,
    })),
  });
}));


module.exports = router;
