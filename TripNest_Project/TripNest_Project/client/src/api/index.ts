import type {ApiUser,Booking,ChecklistItem,Expense,FamilySupportRequest,Offer,SupportTicket,TravelService,Trip,WalletAccount,WalletTransaction} from '../../../shared/types';
interface AuthResponse{token:string;user:ApiUser;expiresAt:string;}
const API_BASE='/api';
export const isPresentationMode=new URLSearchParams(window.location.search).get('demo')==='1';
const demoUser:ApiUser={id:'demo-user',name:'TripNest Preview',email:'preview@example.invalid',role:'user',created_at:'2026-01-01T00:00:00.000Z'};
const demoTrip:Trip={id:'demo-trip',name:'Barcelona getaway',destination:'Barcelona',start_date:'2026-08-12',end_date:'2026-08-18',traveler_count:2,budget_amount:1200,notes:'Sample itinerary for the local presentation.',created_at:'2026-01-01T00:00:00.000Z',updated_at:'2026-01-01T00:00:00.000Z'};
const demoServices:TravelService[]=[
 {id:'1',code:'flights',name:'Flights',description:'Sample flight offers.'},{id:'2',code:'hotels',name:'Hotels',description:'Sample hotel offers.'},
 {id:'3',code:'car-rentals',name:'Car Rentals',description:'Sample car rental offers.'},{id:'4',code:'tours-activities',name:'Tours & Activities',description:'Sample tours and activities.'},
 {id:'5',code:'airport-transfers',name:'Airport Transfers',description:'Sample airport transfers.'},{id:'6',code:'travel-packages',name:'Travel Packages',description:'Sample travel packages.'},{id:'7',code:'travel-insurance',name:'Travel Insurance',description:'Sample travel insurance.'}
];
const demoOffers:Offer[]=[
 {id:'1',code:'demo-flight',title:'Barcelona sample flight',description:'Illustrative offer only; route and price are not confirmed.',serviceType:'flights',destination:'Barcelona',image:null,price:129,currency:'EUR',discount:null,rating:null,startDate:null,endDate:null,availability:'sample',serviceDetails:{departureAirport:'TBD',arrivalAirport:'BCN'},createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'},
 {id:'2',code:'demo-hotel',title:'Barcelona sample hotel',description:'Illustrative offer only; room and rate are not confirmed.',serviceType:'hotels',destination:'Barcelona',image:null,price:110,currency:'EUR',discount:5,rating:4.5,startDate:null,endDate:null,availability:'sample',serviceDetails:{roomType:'Standard',nights:1},createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'},
 {id:'3',code:'demo-car',title:'Sample compact car rental',description:'Illustrative offer only; vehicle and dates are not confirmed.',serviceType:'car-rentals',destination:'Barcelona',image:null,price:45,currency:'EUR',discount:null,rating:null,startDate:null,endDate:null,availability:'sample',serviceDetails:{vehicleClass:'Compact'},createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'},
 {id:'4',code:'demo-tour',title:'Sample walking tour',description:'Illustrative offer only; schedule is not confirmed.',serviceType:'tours-activities',destination:'Barcelona',image:null,price:25,currency:'EUR',discount:null,rating:4.7,startDate:null,endDate:null,availability:'sample',serviceDetails:{durationHours:2},createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'},
 {id:'5',code:'demo-transfer',title:'Sample airport transfer',description:'Illustrative offer only; route and availability are not confirmed.',serviceType:'airport-transfers',destination:'Barcelona',image:null,price:35,currency:'EUR',discount:null,rating:null,startDate:null,endDate:null,availability:'sample',serviceDetails:{pickupLocation:'BCN Airport'},createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'},
 {id:'6',code:'demo-package',title:'Sample Barcelona package',description:'Illustrative package only; inclusions and dates are not confirmed.',serviceType:'travel-packages',destination:'Barcelona',image:null,price:399,currency:'EUR',discount:null,rating:null,startDate:null,endDate:null,availability:'sample',serviceDetails:{includes:['Sample flight','Sample hotel']},createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'},
 {id:'7',code:'demo-insurance',title:'Sample travel insurance',description:'Illustrative offer only; coverage is not confirmed.',serviceType:'travel-insurance',destination:'Barcelona',image:null,price:19,currency:'EUR',discount:null,rating:null,startDate:null,endDate:null,availability:'sample',serviceDetails:{coverage:'Sample coverage'},createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'}
];
let previewTrips=[demoTrip];
let previewBookings:Booking[]=[{id:'demo-booking',tripId:demoTrip.id,tripName:demoTrip.name,offerId:'1',offerTitle:demoOffers[0].title,serviceName:'Flights',destination:'Barcelona',quantity:1,priceEach:129,currency:'EUR',status:'saved',createdAt:'2026-01-01T00:00:00.000Z',cancelledAt:null}];
let previewExpenses:Expense[]=[{id:'demo-expense-1',title:'Sample museum tickets',category:'activities',amount:36,currency:'EUR',occurredAt:'2026-08-13',createdAt:'2026-01-01T00:00:00.000Z'},{id:'demo-expense-2',title:'Sample local transport',category:'transport',amount:18,currency:'EUR',occurredAt:'2026-08-13',createdAt:'2026-01-01T00:00:00.000Z'}];
let previewChecklist:ChecklistItem[]=[{id:'demo-check-1',label:'Check passport validity',isComplete:true,createdAt:'2026-01-01T00:00:00.000Z'},{id:'demo-check-2',label:'Confirm travel documents',isComplete:false,createdAt:'2026-01-01T00:00:00.000Z'},{id:'demo-check-3',label:'Pack essentials',isComplete:false,createdAt:'2026-01-01T00:00:00.000Z'}];
let previewTickets:SupportTicket[]=[{id:'demo-ticket',userId:demoUser.id,userName:demoUser.name,tripId:demoTrip.id,subject:'Sample support request',message:'This is an example request for the presentation.',status:'open',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'}];
let previewTransactions:WalletTransaction[]=[{id:'demo-transaction',kind:'credit',amount:250,currency:'EUR',description:'Sample starting balance',createdAt:'2026-01-01T00:00:00.000Z'}];
let previewBalance=250;
let previewRequests:FamilySupportRequest[]=[];
let previewId=10;
function presentationResponse<T>(path:string):T{
 const clean=path.split('?')[0];let value:unknown;
 if(clean==='/auth/me')value={user:demoUser};
 else if(clean==='/trips')value={trips:previewTrips};
 else if(/^\/trips\/[^/]+$/.test(clean)){const tripId=decodeURIComponent(clean.split('/')[2]);const trip=previewTrips.find(t=>t.id===tripId);if(!trip)throw new ApiError('Trip not found.',404);value={trip};}
 else if(clean==='/bookings/services')value={services:demoServices};
 else if(clean==='/bookings/offers'){
  const params=new URLSearchParams(path.split('?')[1]||'');const offers=demoOffers.filter(o=>(!params.get('serviceType')||o.serviceType===params.get('serviceType'))&&(!params.get('destination')||o.destination.toLowerCase().includes((params.get('destination')||'').toLowerCase())));
  value={offers,demoNotice:'Sample offers only; price and availability are not confirmed.'};
 }else if(clean==='/bookings')value={bookings:previewBookings};
 else if(clean==='/budget'){const total=previewExpenses.reduce((sum,e)=>sum+Number(e.amount),0);value={expenses:previewExpenses,totals:[{currency:'EUR',total:total.toFixed(2)}]};}
 else if(clean==='/wallet')value={account:{balance:previewBalance,currency:'EUR',updatedAt:new Date().toISOString()},transactions:previewTransactions};
 else if(clean==='/wallet/family-support')value={requests:previewRequests};
 else if(clean==='/support/tickets')value={tickets:previewTickets};
 else if(clean.endsWith('/checklist'))value={items:previewChecklist};
 else if(clean.endsWith('/summary'))value={trip:demoTrip,notice:'Presentation sample only.'};
 else throw new ApiError('This page has no sample data in presentation mode.',404);
 return value as T;
}
function presentationMutation<T>(path:string,method:string,body:Record<string,unknown>):T{
 const now=new Date().toISOString();const id=()=>`preview-${++previewId}`;let value:unknown={};
 if(path==='/trips'&&method==='POST'){
  const trip:Trip={id:id(),name:String(body.name||''),destination:String(body.destination||''),start_date:typeof body.startDate==='string'?body.startDate:null,end_date:typeof body.endDate==='string'?body.endDate:null,traveler_count:typeof body.travelerCount==='number'?body.travelerCount:null,budget_amount:typeof body.budgetAmount==='number'?body.budgetAmount:null,notes:String(body.notes||''),created_at:now,updated_at:now};previewTrips=[trip,...previewTrips];value={trip};
 }else if(/^\/trips\/[^/]+$/.test(path)){
  const tripId=decodeURIComponent(path.split('/')[2]);const current=previewTrips.find(t=>t.id===tripId);
  if(method==='DELETE'){previewTrips=previewTrips.filter(t=>t.id!==tripId);value={};}
  else if(current){const trip={...current,...(typeof body.name==='string'?{name:body.name}:{}),...(typeof body.destination==='string'?{destination:body.destination}:{}),...(typeof body.startDate==='string'||body.startDate===null?{start_date:body.startDate as string|null}:{}),...(typeof body.endDate==='string'||body.endDate===null?{end_date:body.endDate as string|null}:{}),...(typeof body.travelerCount==='number'?{traveler_count:body.travelerCount}:{}),...(typeof body.budgetAmount==='number'?{budget_amount:body.budgetAmount}:{}),...(typeof body.notes==='string'?{notes:body.notes}:{}),updated_at:now};previewTrips=previewTrips.map(t=>t.id===tripId?trip:t);value={trip};}
 }else if(path==='/bookings'&&method==='POST'){
  const trip=previewTrips.find(t=>t.id===body.tripId),offer=demoOffers.find(o=>o.id===body.offerId);if(trip&&offer){const booking:Booking={id:id(),tripId:trip.id,tripName:trip.name,offerId:offer.id,offerTitle:offer.title,serviceName:demoServices.find(s=>s.code===offer.serviceType)?.name||offer.serviceType,destination:offer.destination,quantity:Number(body.quantity)||1,priceEach:Number(offer.price),currency:offer.currency,status:'saved',createdAt:now,cancelledAt:null};previewBookings=[booking,...previewBookings];value={booking,notice:'Sample saved in this browser preview only; no provider reservation was made.'};}
 }else if(/^\/bookings\/[^/]+$/.test(path)&&method==='DELETE'){const bookingId=decodeURIComponent(path.split('/')[2]);previewBookings=previewBookings.filter(b=>b.id!==bookingId);value={message:'Removed from this browser preview.'};}
 else if(path==='/budget/expenses'&&method==='POST'){const expense:Expense={id:id(),title:String(body.title||''),category:String(body.category||'other'),amount:Number(body.amount)||0,currency:'EUR',occurredAt:String(body.occurredAt||new Date().toISOString().slice(0,10)),createdAt:now};previewExpenses=[expense,...previewExpenses];value={expense};}
 else if(/^\/budget\/expenses\/[^/]+$/.test(path)&&method==='DELETE'){const expenseId=decodeURIComponent(path.split('/')[3]);previewExpenses=previewExpenses.filter(e=>e.id!==expenseId);}
 else if(path==='/wallet/transactions'&&method==='POST'){const amount=Number(body.amount)||0;const kind=body.kind==='debit'?'debit':'credit';previewBalance+=kind==='credit'?amount:-amount;const transaction:WalletTransaction={id:id(),kind,amount,currency:'EUR',description:String(body.description||''),createdAt:now};previewTransactions=[transaction,...previewTransactions];value={balance:previewBalance,demoNotice:'Simulated in this browser preview only; no real money moved.'};}
 else if(path==='/wallet/family-support'&&method==='POST'){const request:FamilySupportRequest={id:id(),userId:demoUser.id,tripId:typeof body.tripId==='string'?body.tripId:null,amount:Number(body.amount)||0,currency:'EUR',message:String(body.message||''),status:'pending',createdAt:now};previewRequests=[request,...previewRequests];value={request};}
 else if(/^\/wallet\/family-support\/[^/]+$/.test(path)&&method==='PATCH'){const requestId=decodeURIComponent(path.split('/')[3]);const status=body.status==='approved'?'approved':'declined';previewRequests=previewRequests.map(r=>r.id===requestId?{...r,status}:r);value={status};}
 else if(/^\/support\/trips\/[^/]+\/checklist$/.test(path)&&method==='POST'){const item:ChecklistItem={id:id(),label:String(body.label||''),isComplete:false,createdAt:now};previewChecklist=[...previewChecklist,item];value={item};}
 else if(/^\/support\/checklist\/[^/]+$/.test(path)&&method==='PATCH'){const itemId=decodeURIComponent(path.split('/')[3]);const item=previewChecklist.find(i=>i.id===itemId);if(item){item.isComplete=Boolean(body.isComplete);value={item};}}
 else if(path==='/support/tickets'&&method==='POST'){const ticket:SupportTicket={id:id(),userId:demoUser.id,userName:demoUser.name,tripId:typeof body.tripId==='string'?body.tripId:null,subject:String(body.subject||''),message:String(body.message||''),status:'open',createdAt:now,updatedAt:now};previewTickets=[ticket,...previewTickets];value={ticket};}
 else if(/^\/support\/tickets\/[^/]+\/resolve$/.test(path)&&method==='PATCH'){const ticketId=decodeURIComponent(path.split('/')[3]);const ticket=previewTickets.find(t=>t.id===ticketId);if(ticket){ticket.status='resolved';ticket.updatedAt=now;value={ticket};}}
 else throw new ApiError('This action is unavailable in presentation mode.',405);
 return value as T;
}
let tokenProvider:()=>string|null=()=>null;
export function setTokenProvider(provider:()=>string|null){tokenProvider=provider;}
export class ApiError extends Error{constructor(message:string,public status:number,public fields?:Record<string,string>){super(message);this.name='ApiError';}}
async function request<T>(path:string,options:RequestInit={}):Promise<T>{
 if(isPresentationMode){const method=(options.method||'GET').toUpperCase();if(method==='GET')return presentationResponse<T>(path);let body:Record<string,unknown>={};if(typeof options.body==='string'){try{const parsed:unknown=JSON.parse(options.body);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))body=parsed as Record<string,unknown>;}catch{/* The normal API validation handles malformed JSON. */}}return presentationMutation<T>(path,method,body);}
 const headers=new Headers(options.headers);if(options.body)headers.set('Content-Type','application/json');
 const token=tokenProvider();if(token)headers.set('Authorization',`Bearer ${token}`);
 const response=await fetch(`${API_BASE}${path}`,{...options,headers});const body:unknown=await response.json().catch(()=>({}));
 if(!response.ok){const result=body as {error?:string;fields?:Record<string,string>};throw new ApiError(result.error||'Request failed. Please try again.',response.status,result.fields);}
 return body as T;
}
const json=(method:string,value:unknown,headers:Record<string,string>={}):RequestInit=>({method,headers,body:JSON.stringify(value)});
export const authApi={register:(v:{name:string;email:string;password:string})=>request<AuthResponse>('/auth/register',json('POST',v)),login:(v:{email:string;password:string})=>request<AuthResponse>('/auth/login',json('POST',v)),me:()=>request<{user:ApiUser}>('/auth/me'),logout:()=>request<{message:string}>('/auth/logout',{method:'POST'})};
export const tripsApi={list:()=>request<{trips:Trip[]}>('/trips'),get:(id:string)=>request<{trip:Trip}>(`/trips/${encodeURIComponent(id)}`),create:(v:{name:string;destination:string;startDate?:string;endDate?:string;travelerCount:number;budgetAmount:number;notes?:string})=>request<{trip:Trip}>('/trips',json('POST',v)),update:(id:string,v:Partial<{name:string;destination:string;startDate:string|null;endDate:string|null;travelerCount:number;budgetAmount:number;notes:string}>)=>request<{trip:Trip}>(`/trips/${encodeURIComponent(id)}`,json('PATCH',v)),archive:(id:string)=>request<void>(`/trips/${encodeURIComponent(id)}`,{method:'DELETE'})};
export const bookingsApi={
 services:()=>request<{services:TravelService[]}>('/bookings/services'),
 offers:(filters:{serviceType?:string;destination?:string;q?:string}={})=>{const q=new URLSearchParams(Object.entries(filters).filter(([,v])=>Boolean(v)) as [string,string][]).toString();return request<{offers:Offer[];demoNotice:string}>('/bookings/offers'+(q?'?'+q:''));},
 quote:(id:string,quantity=1)=>request<{total:number;currency:string;demoNotice:string}>(`/bookings/offers/${encodeURIComponent(id)}/quote?quantity=${quantity}`),
 createOffer:(v:Record<string,unknown>)=>request<{offer:Offer}>('/bookings/offers',json('POST',v)),
 updateOffer:(id:string,v:Record<string,unknown>)=>request<{offer:Offer}>(`/bookings/offers/${encodeURIComponent(id)}`,json('PATCH',v)),
 list:()=>request<{bookings:Booking[]}>('/bookings'),
 create:(v:{tripId:string;offerId:string;quantity:number})=>request<{booking:Booking;notice:string}>('/bookings',json('POST',{...v,idempotencyKey:crypto.randomUUID()})),
 cancel:(id:string)=>request<{message:string}>(`/bookings/${encodeURIComponent(id)}`,{method:'DELETE'}),
};
export const budgetApi={list:(tripId:string)=>request<{expenses:Expense[];totals:{currency:string;total:string}[]}>(`/budget?tripId=${encodeURIComponent(tripId)}`),add:(v:{tripId:string;title:string;category:string;amount:number;currency:string;occurredAt?:string})=>request<{expense:Expense}>('/budget/expenses',json('POST',v)),remove:(id:string)=>request<void>(`/budget/expenses/${encodeURIComponent(id)}`,{method:'DELETE'})};
export const walletApi={get:()=>request<{account:WalletAccount;transactions:WalletTransaction[]}>('/wallet'),transact:(v:{kind:'credit'|'debit';amount:number;description:string})=>request<{balance:number;demoNotice:string}>('/wallet/transactions',json('POST',{...v,idempotencyKey:crypto.randomUUID()})),requests:()=>request<{requests:FamilySupportRequest[]}>('/wallet/family-support'),requestSupport:(v:{tripId?:string;amount:number;message:string})=>request<{request:FamilySupportRequest}>('/wallet/family-support',json('POST',v)),decide:(id:string,status:'approved'|'declined')=>request<{status:string}>(`/wallet/family-support/${encodeURIComponent(id)}`,json('PATCH',{status}))};
export const supportApi={checklist:(id:string)=>request<{items:ChecklistItem[]}>(`/support/trips/${encodeURIComponent(id)}/checklist`),addChecklist:(id:string,label:string)=>request<{item:ChecklistItem}>(`/support/trips/${encodeURIComponent(id)}/checklist`,json('POST',{label})),updateChecklist:(id:string,isComplete:boolean)=>request<{item:ChecklistItem}>(`/support/checklist/${encodeURIComponent(id)}`,json('PATCH',{isComplete})),tickets:()=>request<{tickets:SupportTicket[]}>('/support/tickets'),createTicket:(v:{tripId?:string;subject:string;message:string})=>request<{ticket:SupportTicket}>('/support/tickets',json('POST',v)),resolveTicket:(id:string)=>request<{ticket:SupportTicket}>(`/support/tickets/${encodeURIComponent(id)}/resolve`,json('PATCH',{})),summary:(id:string)=>request<Record<string,unknown>>(`/support/trips/${encodeURIComponent(id)}/summary`)};
export type {ApiUser,Booking,ChecklistItem,Expense,FamilySupportRequest,Offer,SupportTicket,TravelService,Trip,WalletAccount,WalletTransaction};
