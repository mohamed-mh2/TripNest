import {configureStore} from '@reduxjs/toolkit';
import sessionReducer from './sessionSlice';
import bookingsReducer from './bookingsSlice';
import supportReducer from './supportSlice';
import walletReducer from './walletSlice';
import tripsReducer from './tripsSlice';
import {setTokenProvider} from '../api';
import {isPresentationMode} from '../api';
function restoreSession(){
 if(isPresentationMode)return {user:{id:'demo-user',name:'TripNest Preview',email:'preview@example.invalid',role:'user' as const,created_at:'2026-01-01T00:00:00.000Z'},token:'demo-preview-session'};
 try{
  const value:unknown=JSON.parse(sessionStorage.getItem('tripnest-session')||'null');
  if(value&&typeof value==='object'&&'token'in value&&'user'in value&&typeof value.token==='string'&&value.user&&typeof value.user==='object')
   return value as {user:import('../../../shared/types').ApiUser;token:string};
 }catch{sessionStorage.removeItem('tripnest-session');}
 return {user:null,token:null};
}
export const store=configureStore({
 reducer:{session:sessionReducer,bookings:bookingsReducer,support:supportReducer,wallet:walletReducer,trips:tripsReducer},
 preloadedState:{session:restoreSession()},
});
store.subscribe(()=>{const {session}=store.getState();if(session.token&&session.user&&session.token!=='demo-preview-session')sessionStorage.setItem('tripnest-session',JSON.stringify(session));else sessionStorage.removeItem('tripnest-session');});
setTokenProvider(()=>store.getState().session.token);
export type RootState=ReturnType<typeof store.getState>;
export type AppDispatch=typeof store.dispatch;
