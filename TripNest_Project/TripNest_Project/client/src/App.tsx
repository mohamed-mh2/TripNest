// تجميع الصفحات والتنقل بينها. المسؤول: madin abed.
// #explain_notes: Minimal shell added by Student 2 so the bookings pages can run. Other pages
// (trips, budget, wallet, support, services extras) are added to the nav and routes by their owners.

import { useEffect } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from './store';
import { demoUserSelected, loadDemoUsers, loadTrips } from './store/sessionSlice';
import ServiceCatalogPage from './features/bookings/ServiceCatalogPage';
import ServiceDetailsPage from './features/bookings/ServiceDetailsPage';
import { BookingDetailsPage, MyBookingsPage } from './pages/Bookings';


function DemoSessionPicker() {
  const dispatch = useAppDispatch();
  const { demoUsers, currentUserId, usersStatus } = useAppSelector((state) => state.session);

  useEffect(() => {
    if (usersStatus === 'idle') {
      dispatch(loadDemoUsers());
    }
  }, [dispatch, usersStatus]);

  const customers = demoUsers.filter((user) => user.role === 'customer');

  return (
    <label className="demo-session" title="Development-only demo session until real sign-in is available">
      <span className="demo-session__label">Demo session</span>
      <select
        value={currentUserId ?? ''}
        onChange={(event) => dispatch(demoUserSelected(event.target.value ? Number(event.target.value) : null))}
        aria-label="Choose a demo customer"
      >
        <option value="">Signed out</option>
        {customers.map((user) => (
          <option key={user.id} value={user.id}>{user.fullName}</option>
        ))}
      </select>
    </label>
  );
}


export default function App() {
  const dispatch = useAppDispatch();
  const { currentUserId, tripsStatus } = useAppSelector((state) => state.session);

  useEffect(() => {
    if (currentUserId !== null && tripsStatus === 'idle') {
      dispatch(loadTrips());
    }
  }, [dispatch, currentUserId, tripsStatus]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <NavLink to="/services" className="brand">
            <span className="brand__mark" aria-hidden="true">TN</span>
            TripNest
          </NavLink>

          <nav className="app-nav" aria-label="Main">
            <NavLink to="/services">Services</NavLink>
            <NavLink to="/bookings">My Bookings</NavLink>
          </nav>

          <DemoSessionPicker />
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/services" replace />} />
          <Route path="/services" element={<ServiceCatalogPage />} />
          <Route path="/services/:serviceId" element={<ServiceDetailsPage />} />
          <Route path="/bookings" element={<MyBookingsPage />} />
          <Route path="/bookings/:bookingId" element={<BookingDetailsPage />} />
          <Route path="*" element={<p className="page-message">Page not found.</p>} />
        </Routes>
      </main>
    </div>
  );
}
