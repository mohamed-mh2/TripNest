import {createSlice,type PayloadAction} from '@reduxjs/toolkit';
import type {ChecklistItem,SupportTicket} from '../../../shared/types';
interface State{checklist:ChecklistItem[];checklistTripId:string|null;tickets:SupportTicket[];}
const slice=createSlice({name:'support',initialState:{checklist:[],checklistTripId:null,tickets:[]} as State,reducers:{
 setChecklist:(s,a:PayloadAction<{tripId:string|null;items:ChecklistItem[]}>)=>{s.checklist=a.payload.items;s.checklistTripId=a.payload.tripId;},
 setTickets:(s,a:PayloadAction<SupportTicket[]>)=>{s.tickets=a.payload;},
}});
export const {setChecklist,setTickets}=slice.actions;export default slice.reducer;
