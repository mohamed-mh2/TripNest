const budget=require('../models/budget');
function idOk(v){return typeof v==='string'&&/^[1-9]\d{0,17}$/.test(v);}
function validDate(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v));}
async function list(req,res,next){
  const tripId=typeof req.query.tripId==='string'?req.query.tripId:'';
  if(!idOk(tripId))return res.status(400).json({error:'A valid tripId is required.'});
  try{const result=await budget.listExpenses(req.user.id,tripId);return result?res.json(result):res.status(404).json({error:'Trip not found.'});}catch(e){return next(e);}
}
async function add(req,res,next){
  const {tripId,title,category='other',amount,currency='EUR',occurredAt}=req.body||{};
  if(!idOk(String(tripId||''))||typeof title!=='string'||title.trim().length<2||title.length>180||
      typeof category!=='string'||category.trim().length<2||category.length>60||
      typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>1000000||
      typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency)||(occurredAt!==undefined&&!validDate(occurredAt)))
    return res.status(400).json({error:'Provide valid trip, title, category, amount, currency and date.'});
  try{const expense=await budget.addExpense(req.user.id,String(tripId),{title:title.trim(),category:category.trim(),amount:Math.round(amount*100)/100,currency,occurredAt});return expense?res.status(201).json({expense}):res.status(404).json({error:'Trip not found.'});}catch(e){return next(e);}
}
async function remove(req,res,next){
  if(!idOk(req.params.id))return res.status(400).json({error:'Invalid expense id.'});
  try{return await budget.deleteExpense(req.user.id,req.params.id)?res.status(204).end():res.status(404).json({error:'Expense not found.'});}catch(e){return next(e);}
}
module.exports={list,add,remove};
