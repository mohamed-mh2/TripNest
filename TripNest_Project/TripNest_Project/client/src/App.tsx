import {useEffect,useState,type ReactNode} from 'react';
import {BrowserRouter,Link,Navigate,Route,Routes,useNavigate} from 'react-router-dom';
import {useDispatch,useSelector} from 'react-redux';
import Auth from './pages/Auth';
import Trips from './pages/Trips';
import TripDetails from './pages/TripDetails';
import Services from './pages/Services';
import Bookings from './pages/Bookings';
import Budget from './pages/Budget';
import Wallet from './pages/Wallet';
import Support from './pages/Support';
import {authApi,isPresentationMode} from './api';
import type {AppDispatch,RootState} from './store';
import {clearSession,setSession} from './store/sessionSlice';
function Home(){
 const {user,token}=useSelector((s:RootState)=>s.session);const dispatch=useDispatch<AppDispatch>();const [checking,setChecking]=useState(Boolean(token));
 useEffect(()=>{if(isPresentationMode||!token){setChecking(false);return;}authApi.me().then(({user:current})=>dispatch(setSession({user:current,token}))).catch(()=>dispatch(clearSession())).finally(()=>setChecking(false));},[token,dispatch]);
 if(checking)return <main className="auth-card">Checking session…</main>;
 if(!user)return <Navigate to="/auth" replace/>;
 return <main className="page-shell"><section className="hero panel"><p className="eyebrow">WELCOME TO TRIPNEST</p><h1>Where will you go next, {user.name}?</h1><p>Plan trips, save travel offers, track expenses, and get ready to travel.</p><Link className="primary-button button-link" to={isPresentationMode?'/trips?demo=1':'/trips'}>Plan a trip</Link></section></main>;
}
function Protected({children}:{children:ReactNode}){const user=useSelector((s:RootState)=>s.session.user);return user?children:<Navigate to="/auth" replace/>;}
function Shell(){
 const user=useSelector((s:RootState)=>s.session.user);
 const dispatch=useDispatch<AppDispatch>();const navigate=useNavigate();
 const page=(path:string)=>isPresentationMode?`${path}?demo=1`:path;
 async function logout(){if(!isPresentationMode){try{await authApi.logout();}catch{/* Clear local state when the API is unavailable. */}}dispatch(clearSession());navigate(isPresentationMode?'/auth?demo=1':'/auth');}
 return <><nav className="top-nav"><Link className="brand" to={page('/')} aria-label="TripNest home"><img className="site-logo nav-logo" src="/tripnest-logo.svg" alt="TripNest" /></Link>{user?<div className="nav-actions"><div className="nav-links"><Link to={page('/trips')}>Trips</Link><Link to={page('/services')}>Services</Link><Link to={page('/bookings')}>Bookings</Link><Link to={page('/budget')}>Budget</Link><Link to={page('/wallet')}>Wallet</Link><Link to={page('/support')}>Support</Link></div><button className="nav-logout" onClick={() => void logout()}>{isPresentationMode?'Exit preview':'Logout'}</button></div>:<Link to={page('/auth')}>Sign in</Link>}</nav>{isPresentationMode&&<div className="demo-notice preview-banner" role="note">Presentation preview · sample data only · changes are not saved</div>}
 <Routes><Route path="/auth" element={<Auth/>}/><Route path="/" element={<Home/>}/>
 <Route path="/trips" element={<Protected><Trips/></Protected>}/><Route path="/trips/:id" element={<Protected><TripDetails/></Protected>}/><Route path="/services" element={<Protected><Services/></Protected>}/>
 <Route path="/bookings" element={<Protected><Bookings/></Protected>}/><Route path="/budget" element={<Protected><Budget/></Protected>}/>
 <Route path="/wallet" element={<Protected><Wallet/></Protected>}/><Route path="/support" element={<Protected><Support/></Protected>}/>
 <Route path="*" element={<Navigate to="/" replace/>}/></Routes></>;
}
export default function App(){return <BrowserRouter><Shell/></BrowserRouter>;}
