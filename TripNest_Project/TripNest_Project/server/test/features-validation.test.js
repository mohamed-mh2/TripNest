const test=require('node:test');
const assert=require('node:assert/strict');
const {validateTrip,validDate}=require('../src/controllers/trips');
const {validateOffer,validDate:validOfferDate}=require('../src/controllers/bookings');
test('trip validation rejects impossible dates and reversed ranges',()=>{
 assert.equal(validDate('2026-02-29'),false); assert.equal(validDate('2028-02-29'),true);
 assert.ok(validateTrip({name:'Holiday',destination:'Rome',startDate:'2026-12-20',endDate:'2026-12-10'}).errors.endDate);
});
test('trip validation requires traveler count and planned budget',()=>{
 const base={name:'Rome break',destination:'Rome'};
 assert.ok(validateTrip(base).errors.travelerCount); assert.ok(validateTrip(base).errors.budgetAmount);
 assert.deepEqual(validateTrip({...base,travelerCount:2,budgetAmount:1200.5}).errors,{});
 assert.ok(validateTrip({...base,travelerCount:0,budgetAmount:-1}).errors.travelerCount);
 assert.ok(validateTrip({...base,travelerCount:21,budgetAmount:1.234}).errors.budgetAmount);
});
test('offer validation enforces catalog service, currency, and dates',()=>{
 const base={title:'Flight sample',description:'Not a confirmed fare.',destination:'Barcelona',serviceType:'flights',price:120,currency:'EUR',availability:'sample',serviceDetails:{departureAirport:'JFK',arrivalAirport:'BCN'}};
 assert.deepEqual(validateOffer(base).errors,{}); assert.ok(validateOffer({...base,serviceType:'unknown'}).errors.serviceType);
 assert.ok(validateOffer({...base,currency:'EURO'}).errors.currency); assert.equal(validOfferDate('2025-02-29'),false);
});
