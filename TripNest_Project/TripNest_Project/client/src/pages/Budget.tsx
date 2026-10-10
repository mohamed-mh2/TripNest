import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useDispatch,useSelector} from 'react-redux';
import {ApiError,budgetApi,tripsApi} from '../api';
import {setExpenses} from '../store/walletSlice';
import type {AppDispatch,RootState} from '../store';
import {selectTrip,tripsFailed,tripsLoaded,tripsLoading} from '../store/tripsSlice';
export default function Budget(){
 const dispatch=useDispatch<AppDispatch>();
 const {trips,selectedTripId}=useSelector((s:RootState)=>s.trips);const tripId=selectedTripId||'';
 const tripIdRef=useRef(tripId);tripIdRef.current=tripId;
 const [title,setTitle]=useState('');const [category,setCategory]=useState('other');const [amount,setAmount]=useState('');const [date,setDate]=useState('');const [error,setError]=useState('');
 async function load(id:string){if(!id){if(!tripIdRef.current)dispatch(setExpenses({tripId:null,expenses:[],totals:[]}));return;}try{const result=await budgetApi.list(id);if(tripIdRef.current===id){dispatch(setExpenses({tripId:id,...result}));setError('');}}catch(e){if(tripIdRef.current===id)setError(e instanceof ApiError?e.message:'Could not load expenses.');}}
 useEffect(()=>{dispatch(tripsLoading());void tripsApi.list().then(({trips:t})=>dispatch(tripsLoaded(t))).catch(e=>dispatch(tripsFailed(e instanceof ApiError?e.message:'Could not load trips.')));},[dispatch]);
 useEffect(()=>{void load(tripId);},[tripId]);
 async function add(e:FormEvent){e.preventDefault();setError('');try{await budgetApi.add({tripId,title,category,amount:Number(amount),currency:'EUR',occurredAt:date||undefined});setTitle('');setAmount('');setDate('');await load(tripId);}catch(err){setError(err instanceof ApiError?err.message:'Could not add expense.');}}
 async function remove(id:string){try{await budgetApi.remove(id);await load(tripId);}catch(e){setError(e instanceof ApiError?e.message:'Could not remove expense.');}}
 const currentExpenses=useSelector((s:RootState)=>s.wallet.expensesTripId===tripId?s.wallet.expenses:[]);const currentTotals=useSelector((s:RootState)=>s.wallet.expensesTripId===tripId?s.wallet.totals:[]);
 const total=currentTotals.reduce((n,t)=>n+Number(t.total),0);const max=Math.max(1,...currentExpenses.map(x=>Number(x.amount)));
 return <main className="page-shell"><header className="page-heading"><div><p className="eyebrow">TRIP SPENDING</p><h1>Budget & expenses</h1></div></header>
 <section className="panel budget-summary"><label>Trip<select value={tripId} onChange={e=>dispatch(selectTrip(e.target.value||null))}><option value="">Choose a trip</option>{trips.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><div><span>Total recorded expenses</span><strong>{new Intl.NumberFormat(undefined,{style:'currency',currency:currentTotals[0]?.currency||'EUR'}).format(total)}</strong></div></section>
 {error&&<p className="form-error" role="alert">{error}</p>}
 {tripId&&<section className="panel"><h2>Add expense</h2><form className="trip-form" onSubmit={add}><label>Description<input required minLength={2} maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{['other','food','transport','accommodation','activities','insurance'].map(x=><option key={x}>{x}</option>)}</select></label><label>Amount (EUR)<input type="number" min="0" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><div className="form-actions"><button className="primary-button">Add expense</button></div></form></section>}
 <section className="trip-list">{currentExpenses.map(x=><article className="panel expense-row" key={x.id}><div><strong>{x.title}</strong><p>{x.category} · {x.occurredAt}</p><div className="bar-track"><div className="bar-fill" style={{width:`${Math.max(4,Number(x.amount)/max*100)}%`}}/></div></div><strong>{new Intl.NumberFormat(undefined,{style:'currency',currency:x.currency}).format(Number(x.amount))}</strong><button className="danger-button" onClick={()=>void remove(x.id)}>Remove</button></article>)}
 {tripId&&currentExpenses.length===0&&!error&&<div className="panel empty-state">No expenses recorded for this trip.</div>}</section></main>;
}
