const support = require('../models/support');
function idOk(v) { return typeof v === 'string' && /^[1-9]\d{0,17}$/.test(v); }
async function listChecklist(req,res,next) {
  if(!idOk(req.params.tripId)) return res.status(400).json({error:'Invalid trip id.'});
  try { const items=await support.checklist(req.user.id,req.params.tripId); return items ? res.json({items}) : res.status(404).json({error:'Trip not found.'}); } catch(e){return next(e);}
}
async function addChecklist(req,res,next) {
  const label=req.body && req.body.label;
  if(!idOk(req.params.tripId)||typeof label!=='string'||label.trim().length<2||label.length>180) return res.status(400).json({error:'Provide a valid checklist label and trip.'});
  try { const item=await support.addChecklist(req.user.id,req.params.tripId,label.trim()); return item ? res.status(201).json({item}) : res.status(404).json({error:'Trip not found or item already exists.'}); } catch(e){return next(e);}
}
async function updateChecklist(req,res,next) {
  const complete=req.body && req.body.isComplete;
  if(!idOk(req.params.id)||typeof complete!=='boolean') return res.status(400).json({error:'Provide a valid checklist id and completion state.'});
  try { const item=await support.updateChecklist(req.user.id,req.params.id,complete); return item ? res.json({item}) : res.status(404).json({error:'Checklist item not found.'}); } catch(e){return next(e);}
}
async function createTicket(req,res,next) {
  const {tripId,subject,message}=req.body||{};
  if((tripId!=null&&!idOk(String(tripId)))||typeof subject!=='string'||subject.trim().length<3||subject.length>180||typeof message!=='string'||message.trim().length<5||message.length>10000) return res.status(400).json({error:'Provide a valid subject and message.'});
  try { const ticket=await support.createTicket(req.user.id,tripId?String(tripId):null,subject.trim(),message.trim()); return ticket?res.status(201).json({ticket}):res.status(404).json({error:'Trip not found.'}); } catch(e){return next(e);}
}
async function listTickets(req,res,next) {
  try { return res.json({tickets:await support.tickets(req.user.id,req.user.role==='admin')}); } catch(e){return next(e);}
}
async function resolve(req,res,next) {
  if(!idOk(req.params.id)) return res.status(400).json({error:'Invalid ticket id.'});
  try { const ticket=await support.resolveTicket(req.params.id); return ticket?res.json({ticket}):res.status(404).json({error:'Open ticket not found.'}); } catch(e){return next(e);}
}
async function summary(req,res,next) {
  if(!idOk(req.params.tripId)) return res.status(400).json({error:'Invalid trip id.'});
  try { const result=await support.tripSummary(req.user.id,req.params.tripId); return result?res.json(result):res.status(404).json({error:'Trip not found.'}); } catch(e){return next(e);}
}
module.exports={listChecklist,addChecklist,updateChecklist,createTicket,listTickets,resolve,summary};
