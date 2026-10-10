import {useEffect,useState,type FormEvent} from 'react';
import {useDispatch,useSelector} from 'react-redux';
import {ApiError,bookingsApi,tripsApi,type Offer} from '../api';
import {setOffers,setServices} from '../store/bookingsSlice';
import type {AppDispatch,RootState} from '../store';
import {selectTrip,tripsFailed,tripsLoaded,tripsLoading} from '../store/tripsSlice';
export default function Services(){
 const dispatch=useDispatch<AppDispatch>();const {offers,services}=useSelector((s:RootState)=>s.bookings);const user=useSelector((s:RootState)=>s.session.user);
 const {trips,selectedTripId}=useSelector((s:RootState)=>s.trips);const tripId=selectedTripId||'';
 const [type,setType]=useState('');const [destination,setDestination]=useState('');
 const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState('');
 const [title,setTitle]=useState('');const [description,setDescription]=useState('');const [serviceType,setServiceType]=useState('flights');const [offerDestination,setOfferDestination]=useState('Barcelona');
 const [image,setImage]=useState('');const [price,setPrice]=useState('');const [discount,setDiscount]=useState('');const [rating,setRating]=useState('');const [details,setDetails]=useState('{}');
 async function loadOffers(){const r=await bookingsApi.offers({serviceType:type||undefined,destination:destination||undefined});dispatch(setOffers(r.offers));}
 useEffect(()=>{dispatch(tripsLoading());void Promise.all([bookingsApi.services(),tripsApi.list()]).then(([s,t])=>{dispatch(setServices(s.services));dispatch(tripsLoaded(t.trips));}).catch(e=>{const message=e instanceof ApiError?e.message:'Could not load services.';dispatch(tripsFailed(message));setError(message);});},[dispatch]);
 useEffect(()=>{void loadOffers().catch(e=>setError(e instanceof ApiError?e.message:'Could not load offers.'));},[type,destination]);
 async function save(id:string){if(!tripId){setError('Create a trip before saving an offer.');return;}setBusy(id);setError('');setNotice('');try{setNotice((await bookingsApi.create({tripId,offerId:id,quantity:1})).notice);}catch(e){setError(e instanceof ApiError?e.message:'Could not save this offer.');}finally{setBusy('');}}
 async function createOffer(e:FormEvent){e.preventDefault();setError('');try{const parsed:unknown=JSON.parse(details);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Service details must be a JSON object.');
  await bookingsApi.createOffer({title,description,serviceType,destination:offerDestination,image:image||null,price:Number(price),currency:'EUR',discount:discount===''?null:Number(discount),rating:rating===''?null:Number(rating),availability:'sample',serviceDetails:parsed});
  setTitle('');setDescription('');setPrice('');setDiscount('');setRating('');setDetails('{}');await loadOffers();setNotice('Sample offer added.');}catch(err){setError(err instanceof ApiError?err.message:err instanceof Error?err.message:'Could not create offer.');}}
 async function toggleActive(o:Offer){try{await bookingsApi.updateOffer(o.id,{active:false});await loadOffers();}catch(e){setError(e instanceof ApiError?e.message:'Could not update offer.');}}
 const priceLabel=(o:Offer)=>new Intl.NumberFormat(undefined,{style:'currency',currency:o.currency}).format(Number(o.price)*(1-Number(o.discount||0)/100));
 return <main className="page-shell"><header className="page-heading"><div><p className="eyebrow">TRAVEL SERVICES</p><h1>Explore offers</h1></div></header>
 <p className="demo-notice" role="note">Sample catalogue only. Prices and availability are not confirmed with providers; saving an offer does not place a reservation.</p>
 <section className="filter-bar panel"><label>Service<select value={type} onChange={e=>setType(e.target.value)}><option value="">All services</option>{services.map(s=><option key={s.id} value={s.code}>{s.name}</option>)}</select></label>
 <label>Destination<input value={destination} maxLength={160} onChange={e=>setDestination(e.target.value)} placeholder="Search destination"/></label>
 <label>Save to trip<select value={tripId} onChange={e=>dispatch(selectTrip(e.target.value||null))}><option value="">Choose a trip</option>{trips.map(t=><option key={t.id} value={t.id}>{t.name} — {t.destination}</option>)}</select></label></section>
 {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="success-notice" role="status">{notice}</p>}
 {user?.role==='admin'&&<section className="panel section-gap"><h2>Add sample offer</h2><form className="trip-form" onSubmit={createOffer}>
 <label>Service<select value={serviceType} onChange={e=>setServiceType(e.target.value)}>{services.map(s=><option key={s.id} value={s.code}>{s.name}</option>)}</select></label>
 <label>Title<input required minLength={2} maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Destination<input required value={offerDestination} onChange={e=>setOfferDestination(e.target.value)}/></label>
 <label>Image URL or local path<input value={image} onChange={e=>setImage(e.target.value)}/></label><label>Price (EUR)<input type="number" min="0" step=".01" required value={price} onChange={e=>setPrice(e.target.value)}/></label>
 <label>Discount %<input type="number" min="0" max="100" step=".1" value={discount} onChange={e=>setDiscount(e.target.value)}/></label>
 <label>Rating<input type="number" min="0" max="5" step=".1" value={rating} onChange={e=>setRating(e.target.value)}/></label>
 <label className="wide-field">Description<textarea maxLength={4000} required value={description} onChange={e=>setDescription(e.target.value)}/></label>
 <label className="wide-field">Service details JSON (e.g. airport codes, room type, nights)<textarea value={details} onChange={e=>setDetails(e.target.value)}/></label><div className="form-actions"><button className="primary-button">Add sample offer</button></div></form></section>}
 <section className="offer-grid section-gap">{offers.map(o=><article className="panel offer-card" key={o.id}>{o.image?<img src={o.image} alt="" loading="lazy"/>:<div className="offer-placeholder">TripNest</div>}<div className="offer-content">
 <div className="offer-meta"><span>{o.serviceType.split('-').join(' ')}</span><span className="sample-badge">{o.availability==='sample'?'Sample':o.availability}</span></div><h2>{o.title}</h2><p>{o.description}</p><p>{o.destination}{o.rating?' · ★ '+o.rating:''}</p>
 {o.startDate&&<small>{o.startDate}{o.endDate?' — '+o.endDate:''}</small>}
 {o.serviceType==='flights'&&<small>Route: {String(o.serviceDetails.departureAirport||'TBD')} → {String(o.serviceDetails.arrivalAirport||'TBD')}</small>}
 {o.serviceType==='hotels'&&<small>{String(o.serviceDetails.roomType||'Room details pending')} · {String(o.serviceDetails.nights||'—')} nights</small>}
 <div className="offer-bottom"><strong>{priceLabel(o)} {Number(o.discount)>0&&<del>{new Intl.NumberFormat(undefined,{style:'currency',currency:o.currency}).format(Number(o.price))}</del>}</strong><div className="card-actions"><button className="primary-button" disabled={busy===o.id||o.availability==='sold_out'||!tripId} onClick={()=>void save(o.id)}>{busy===o.id?'Saving…':'Save to trip'}</button>{user?.role==='admin'&&<button className="danger-button" onClick={()=>void toggleActive(o)}>Remove</button>}</div></div></div></article>)}</section>
 {offers.length===0&&!error&&<div className="panel empty-state">No offers match. Apply the database seed or add sample offers as an administrator.</div>}
 </main>;
}
