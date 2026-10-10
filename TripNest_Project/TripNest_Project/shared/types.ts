export interface ApiUser { id: string; name: string; email: string; role: 'user' | 'admin'; created_at: string; }
export interface Trip { id: string; name: string; destination: string; start_date: string | null; end_date: string | null; traveler_count: number | null; budget_amount: string | number | null; notes: string; created_at: string; updated_at: string; }
export type ServiceCode = 'flights' | 'hotels' | 'car-rentals' | 'tours-activities' | 'airport-transfers' | 'travel-packages' | 'travel-insurance';
export interface TravelService { id: string; code: ServiceCode; name: string; description: string; }
export interface Offer {
 id:string;code:string;title:string;description:string;serviceType:ServiceCode;destination:string;image:string|null;
 price:string|number;currency:string;discount:string|number|null;rating:string|number|null;startDate:string|null;endDate:string|null;
 availability:'sample'|'available'|'sold_out';serviceDetails:Record<string,unknown>;createdAt:string;updatedAt:string;
}
export interface Booking {id:string;tripId:string;tripName:string;offerId:string;offerTitle:string;serviceName:string;destination:string;quantity:number;priceEach:string|number;currency:string;status:'saved'|'cancelled';createdAt:string;cancelledAt:string|null;}
export interface Expense {id:string;title:string;category:string;amount:string|number;currency:string;occurredAt:string;createdAt:string;}
export interface WalletAccount {balance:string|number;currency:string;updatedAt:string;}
export interface WalletTransaction {id:string;kind:'credit'|'debit';amount:string|number;currency:string;description:string;createdAt:string;}
export interface ChecklistItem {id:string;label:string;isComplete:boolean;createdAt:string;}
export interface SupportTicket {id:string;userId:string;userName?:string;tripId:string|null;subject:string;message:string;status:'open'|'resolved';createdAt:string;updatedAt:string;}
export interface FamilySupportRequest {id:string;userId:string;userName?:string;tripId:string|null;amount:string|number;currency:string;message:string;status:'pending'|'approved'|'declined';createdAt:string;}
