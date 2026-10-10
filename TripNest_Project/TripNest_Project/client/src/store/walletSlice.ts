import {createSlice,type PayloadAction} from '@reduxjs/toolkit';
import type {Expense,WalletAccount,WalletTransaction} from '../../../shared/types';
interface State{account:WalletAccount|null;transactions:WalletTransaction[];expenses:Expense[];expensesTripId:string|null;totals:{currency:string;total:string}[];}
const slice=createSlice({name:'wallet',initialState:{account:null,transactions:[],expenses:[],expensesTripId:null,totals:[]} as State,reducers:{
 setWallet:(s,a:PayloadAction<{account:WalletAccount;transactions:WalletTransaction[]}>)=>{s.account=a.payload.account;s.transactions=a.payload.transactions;},
 setExpenses:(s,a:PayloadAction<{tripId:string|null;expenses:Expense[];totals:{currency:string;total:string}[]}>)=>{s.expensesTripId=a.payload.tripId;s.expenses=a.payload.expenses;s.totals=a.payload.totals;},
}});
export const {setWallet,setExpenses}=slice.actions;export default slice.reducer;
