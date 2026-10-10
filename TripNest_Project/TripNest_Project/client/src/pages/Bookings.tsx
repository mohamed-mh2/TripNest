import {useCallback,useEffect,useState} from 'react';
import {useDispatch,useSelector} from 'react-redux';
import {ApiError,bookingsApi} from '../api';
import type {AppDispatch,RootState} from '../store';
import {setBookings} from '../store/bookingsSlice';
export default function Bookings(){
 const dispatch=useDispatch<AppDispatch>();const rows=useSelector((s:RootState)=>s.bookings.bookings);const [error,setError]=useState('');
 const load=useCallback(async()=>{try{dispatch(setBookings((await bookingsApi.list()).bookings));setError('');}catch(e){setError(e instanceof ApiError?e.message:'Could not load saved offers.');}},[dispatch]);
 useEffect(()=>{void load();},[load]);
 async function cancel(id:string){try{await bookingsApi.cancel(id);await load();}catch(e){setError(e instanceof ApiError?e.message:'Could not remove saved offer.');}}
 return <main className="page-shell"><header className="page-heading"><div><p className="eyebrow">YOUR ITINERARY</p><h1>Saved offers</h1></div></header><p className="demo-notice">These items are saved in TripNest only. No reservation has been sent to a travel provider.</p>{error&&<p className="form-error" role="alert">{error}</p>}
 <section className="trip-list">{rows.map(b=><article className="panel trip-card" key={b.id}><div><p className="eyebrow">{b.tripName} · {b.serviceName}</p><h2>{b.offerTitle}</h2><p>{b.destination} · {b.quantity} · {new Intl.NumberFormat(undefined,{style:'currency',currency:b.currency}).format(Number(b.priceEach)*b.quantity)}</p><span className="sample-badge">{b.status}</span></div>{b.status==='saved'&&<button className="danger-button" onClick={()=>void cancel(b.id)}>Remove</button>}</article>)}
 {rows.length===0&&!error&&<div className="panel empty-state">No saved offers. Explore services to add one.</div>}</section></main>;
}
