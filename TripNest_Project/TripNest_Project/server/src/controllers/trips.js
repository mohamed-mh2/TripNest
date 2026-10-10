const trips = require('../models/trips');

function validDate(value) {
  if (value === null || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number); const date = new Date(Date.UTC(year, month - 1, day));
  return year > 0 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function validateTrip(body, partial = false) { const errors = {}; const value = {};
  for (const key of ['name', 'destination']) {
    if (body[key] !== undefined) { if (typeof body[key] !== 'string' || body[key].trim().length < 2 || body[key].trim().length > (key === 'name' ? 120 : 160)) errors[key] = 'Enter a valid value.'; else value[key] = body[key].trim(); }
    else if (!partial) errors[key] = 'This field is required.';
  }
  for (const key of ['startDate', 'endDate']) if (body[key] !== undefined) { if (!validDate(body[key])) errors[key] = 'Use a valid date in YYYY-MM-DD format.'; else value[key] = body[key] || null; }
  if (body.travelerCount !== undefined) {
    if (!Number.isInteger(body.travelerCount) || body.travelerCount < 1 || body.travelerCount > 20) errors.travelerCount = 'Enter a whole number of travelers from 1 to 20.';
    else value.travelerCount = body.travelerCount;
  } else if (!partial) errors.travelerCount = 'Number of travelers is required.';
  if (body.budgetAmount !== undefined) {
    const amount = typeof body.budgetAmount === 'number' ? body.budgetAmount : Number(body.budgetAmount);
    if (body.budgetAmount === null || body.budgetAmount === '' || !Number.isFinite(amount) || amount < 0 || amount > 9999999999.99 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8) errors.budgetAmount = 'Enter a budget from 0 to 9,999,999,999.99 EUR with up to 2 decimal places.';
    else value.budgetAmount = amount;
  } else if (!partial) errors.budgetAmount = 'Planned budget is required.';
  if (body.notes !== undefined) { if (typeof body.notes !== 'string' || body.notes.length > 4000) errors.notes = 'Notes must be at most 4000 characters.'; else value.notes = body.notes.trim(); }
  const start = value.startDate === undefined ? body.startDate : value.startDate; const end = value.endDate === undefined ? body.endDate : value.endDate;
  if (start && end && end < start) errors.endDate = 'End date must be on or after the start date.'; return { value, errors };
}
function validId(raw) { return typeof raw === 'string' && /^[1-9]\d{0,17}$/.test(raw); }
async function list(req,res,next) { try { return res.json({trips:await trips.listForUser(req.user.id)}); } catch(e) { return next(e); } }
async function get(req,res,next) { if(!validId(req.params.id)) return res.status(400).json({error:'Invalid trip id.'}); try { const trip=await trips.findForUser(req.params.id,req.user.id); return trip?res.json({trip}):res.status(404).json({error:'Trip not found.'}); } catch(e){return next(e);} }
async function create(req,res,next) { const {value,errors}=validateTrip(req.body||{}); if(Object.keys(errors).length)return res.status(400).json({error:'Validation failed.',fields:errors}); try{return res.status(201).json({trip:await trips.create({...value,userId:req.user.id})});}catch(e){return next(e);} }
async function update(req,res,next) {
 if(!validId(req.params.id))return res.status(400).json({error:'Invalid trip id.'}); const {value,errors}=validateTrip(req.body||{},true);
 if(Object.keys(errors).length)return res.status(400).json({error:'Validation failed.',fields:errors}); if(!Object.keys(value).length)return res.status(400).json({error:'Provide at least one field to update.'});
 try{const current=await trips.findForUser(req.params.id,req.user.id);if(!current)return res.status(404).json({error:'Trip not found.'});
 const start=value.startDate!==undefined?value.startDate:current.start_date;const end=value.endDate!==undefined?value.endDate:current.end_date;
 if(start&&end&&end<start)return res.status(400).json({error:'End date must be on or after the start date.',fields:{endDate:'Invalid date range.'}});
 const trip=await trips.update({...value,id:req.params.id,userId:req.user.id});return trip?res.json({trip}):res.status(404).json({error:'Trip not found.'});}catch(e){return next(e);}
}
async function archive(req,res,next) { if(!validId(req.params.id))return res.status(400).json({error:'Invalid trip id.'});try{const ok=await trips.archive(req.params.id,req.user.id);return ok?res.status(204).end():res.status(404).json({error:'Trip not found.'});}catch(e){return next(e);} }
module.exports={list,get,create,update,archive,validateTrip,validDate};
