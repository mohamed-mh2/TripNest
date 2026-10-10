import {createSlice,type PayloadAction} from '@reduxjs/toolkit';
import type {Booking,Offer,TravelService} from '../../../shared/types';
interface State{services:TravelService[];offers:Offer[];bookings:Booking[];}
const slice=createSlice({name:'bookings',initialState:{services:[],offers:[],bookings:[]} as State,reducers:{
 setServices:(s,a:PayloadAction<TravelService[]>)=>{s.services=a.payload;},
 setOffers:(s,a:PayloadAction<Offer[]>)=>{s.offers=a.payload;},
 setBookings:(s,a:PayloadAction<Booking[]>)=>{s.bookings=a.payload;},
}});
export const {setServices,setOffers,setBookings}=slice.actions;export default slice.reducer;
