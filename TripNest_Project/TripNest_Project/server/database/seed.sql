INSERT INTO travel_services (code, name, description) VALUES
  ('flights', 'Flights', 'Sample flight offers. Verify details with the provider before booking.'),
  ('hotels', 'Hotels', 'Sample hotel offers. Verify room availability with the provider.'),
  ('car-rentals', 'Car Rentals', 'Sample car rental offers.'),
  ('tours-activities', 'Tours & Activities', 'Sample tours and local activities.'),
  ('airport-transfers', 'Airport Transfers', 'Sample airport transfer offers.'),
  ('travel-packages', 'Travel Packages', 'Sample travel package offers.'),
  ('travel-insurance', 'Travel Insurance', 'Sample insurance offers. Review policy terms before purchase.')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO offers (code, service_id, title, description, destination, price, currency, discount, rating, availability, service_details)
SELECT v.code, s.id, v.title, v.description, 'Barcelona', v.price, 'EUR', v.discount, v.rating, 'sample', v.details::jsonb
FROM (VALUES
  ('demo-flight-barcelona', 'flights', 'Barcelona sample flight', 'Illustrative offer only; dates, route, and price are not confirmed.', 129.00::numeric, NULL::numeric, NULL::numeric, '{"departureAirport":"TBD","arrivalAirport":"BCN","cabinClass":"Economy"}'),
  ('demo-hotel-barcelona', 'hotels', 'Barcelona sample hotel', 'Illustrative offer only; room and nightly rate are not confirmed.', 110.00::numeric, 5.0::numeric, 4.5::numeric, '{"roomType":"Standard","nights":1}'),
  ('demo-car-barcelona', 'car-rentals', 'Barcelona sample car rental', 'Illustrative offer only; vehicle and dates are not confirmed.', 45.00::numeric, NULL::numeric, NULL::numeric, '{"vehicleClass":"Compact","pickupLocation":"Barcelona"}'),
  ('demo-tour-barcelona', 'tours-activities', 'Barcelona sample walking tour', 'Illustrative offer only; schedule and availability are not confirmed.', 25.00::numeric, NULL::numeric, 4.7::numeric, '{"activityType":"Walking tour","durationHours":2}'),
  ('demo-transfer-barcelona', 'airport-transfers', 'Barcelona sample airport transfer', 'Illustrative offer only; route and availability are not confirmed.', 35.00::numeric, NULL::numeric, NULL::numeric, '{"pickupLocation":"BCN Airport","dropoffLocation":"City centre"}'),
  ('demo-package-barcelona', 'travel-packages', 'Barcelona sample travel package', 'Illustrative package only; included services and dates are not confirmed.', 399.00::numeric, NULL::numeric, NULL::numeric, '{"includes":["Sample flight","Sample hotel"]}'),
  ('demo-insurance-barcelona', 'travel-insurance', 'Sample travel insurance', 'Illustrative offer only; coverage and eligibility are not confirmed.', 19.00::numeric, NULL::numeric, NULL::numeric, '{"coverage":"Sample coverage; review provider policy"}')
) AS v(code, service_code, title, description, price, discount, rating, details)
JOIN travel_services s ON s.code = v.service_code
ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description,
  price = EXCLUDED.price, currency = EXCLUDED.currency, service_details = EXCLUDED.service_details,
  availability = 'sample', updated_at = NOW();
