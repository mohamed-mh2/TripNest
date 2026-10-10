const db = require('../db');
const OFFER_FIELDS = `o.id,o.code,o.title,o.description,s.code AS "serviceType",o.destination,o.image,o.price,o.currency,o.discount,o.rating,o.start_date AS "startDate",o.end_date AS "endDate",o.availability,o.service_details AS "serviceDetails",o.created_at AS "createdAt",o.updated_at AS "updatedAt"`;
async function listServices(){return (await db.query('SELECT id,code,name,description FROM travel_services WHERE active=TRUE ORDER BY id')).rows;}
async function listOffers({serviceType,destination,query}){
 return (await db.query(
  `SELECT ${OFFER_FIELDS} FROM offers o JOIN travel_services s ON s.id=o.service_id
   WHERE o.active=TRUE AND ($1::text IS NULL OR s.code=$1)
    AND ($2::text IS NULL OR o.destination ILIKE '%'||$2||'%')
    AND ($3::text IS NULL OR o.title ILIKE '%'||$3||'%' OR o.description ILIKE '%'||$3||'%')
   ORDER BY o.created_at DESC`,[serviceType||null,destination||null,query||null])).rows;
}
async function getOffer(id){const r=await db.query(`SELECT ${OFFER_FIELDS} FROM offers o JOIN travel_services s ON s.id=o.service_id WHERE o.id=$1 AND o.active=TRUE`,[id]);return r.rows[0]||null;}
async function createOffer(data){
 const result=await db.query(
  `INSERT INTO offers(code,service_id,title,description,destination,image,price,currency,discount,rating,start_date,end_date,availability,service_details)
   SELECT $1,id,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb FROM travel_services WHERE code=$2 AND active=TRUE
   RETURNING id`,
  [data.code,data.serviceType,data.title,data.description,data.destination,data.image,data.price,data.currency,data.discount,data.rating,data.startDate,data.endDate,data.availability,JSON.stringify(data.serviceDetails)]
 );
 if(!result.rowCount)return null;return getOffer(result.rows[0].id);
}
async function updateOffer(id,data){
 const fields=['title','description','destination','image','price','currency','discount','rating','availability','serviceDetails','active'];
 const has=(key)=>Object.prototype.hasOwnProperty.call(data,key);
 const r=await db.query(
  `UPDATE offers SET title=COALESCE($2,title),description=COALESCE($3,description),destination=COALESCE($4,destination),
   image=CASE WHEN $5::boolean THEN $6 ELSE image END,price=COALESCE($7,price),currency=COALESCE($8,currency),
   discount=CASE WHEN $9::boolean THEN $10::numeric ELSE discount END,rating=CASE WHEN $11::boolean THEN $12::numeric ELSE rating END,
   availability=COALESCE($13,availability),service_details=CASE WHEN $14::boolean THEN $15::jsonb ELSE service_details END,
   active=COALESCE($16,active),updated_at=NOW() WHERE id=$1 RETURNING id`,
  [id,data.title??null,data.description??null,data.destination??null,has('image'),data.image??null,data.price??null,data.currency??null,
   has('discount'),data.discount??null,has('rating'),data.rating??null,data.availability??null,has('serviceDetails'),JSON.stringify(data.serviceDetails||{}),data.active??null]
 );
 void fields;if(!r.rowCount)return null;return getOffer(id);
}
async function createBooking({userId,tripId,offerId,quantity,idempotencyKey}){
 return db.transaction(async(client)=>{
  const trip=await client.query('SELECT id FROM trips WHERE id=$1 AND user_id=$2 AND archived_at IS NULL FOR UPDATE',[tripId,userId]);
  if(!trip.rowCount)return {error:'trip'};
  const offer=await client.query('SELECT id,price,currency,availability,discount FROM offers WHERE id=$1 AND active=TRUE FOR UPDATE',[offerId]);
  if(!offer.rowCount)return {error:'offer'};
  const data=offer.rows[0];if(data.availability==='sold_out')return {error:'unavailable'};
  const price=Number(data.price)*(1-Number(data.discount||0)/100);
  const inserted=await client.query(
   `INSERT INTO bookings(user_id,trip_id,offer_id,quantity,price_each,currency,status,idempotency_key)
    VALUES($1,$2,$3,$4,$5,$6,'saved',$7) ON CONFLICT(user_id,idempotency_key) DO NOTHING RETURNING id`,
   [userId,tripId,offerId,quantity,Math.round(price*100)/100,data.currency,idempotencyKey]
  );
  const row=inserted.rowCount
   ?(await client.query('SELECT * FROM bookings WHERE id=$1',[inserted.rows[0].id])).rows[0]
   :(await client.query('SELECT * FROM bookings WHERE user_id=$1 AND idempotency_key=$2',[userId,idempotencyKey])).rows[0];
  return {booking:row};
 });
}
async function listBookings(userId){
 return (await db.query(
  `SELECT b.id,b.trip_id AS "tripId",t.name AS "tripName",b.offer_id AS "offerId",o.title AS "offerTitle",
   s.name AS "serviceName",o.destination,b.quantity,b.price_each AS "priceEach",b.currency,b.status,
   b.created_at AS "createdAt",b.cancelled_at AS "cancelledAt"
   FROM bookings b JOIN trips t ON t.id=b.trip_id JOIN offers o ON o.id=b.offer_id JOIN travel_services s ON s.id=o.service_id
   WHERE b.user_id=$1 ORDER BY b.created_at DESC`,[userId])).rows;
}
async function cancelBooking(id,userId){const r=await db.query(`UPDATE bookings SET status='cancelled',cancelled_at=NOW() WHERE id=$1 AND user_id=$2 AND status='saved' RETURNING id`,[id,userId]);return r.rowCount>0;}
module.exports={listServices,listOffers,getOffer,createOffer,updateOffer,createBooking,listBookings,cancelBooking};
