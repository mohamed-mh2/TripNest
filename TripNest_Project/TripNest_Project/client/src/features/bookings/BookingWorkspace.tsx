import { useEffect } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store';
import { loadBookingSession } from '../../store/sessionSlice';
import ServiceCatalogPage from './ServiceCatalogPage';
import ServiceDetailsPage from './ServiceDetailsPage';
import { MyBookingsPage, BookingDetailsPage } from '../../pages/Bookings';

export default function BookingWorkspace() {
  const dispatch = useAppDispatch();
  const { tripsStatus, error } = useAppSelector((state) => state.session);
  useEffect(() => {
    if (tripsStatus === 'idle') void dispatch(loadBookingSession());
  }, [dispatch, tripsStatus]);
  return (
    <main className="bookings-workspace">
      {tripsStatus === 'error' && (
        <div className="status status--error" role="alert">
          <span>{error}</span>
          <button className="button" onClick={() => dispatch(loadBookingSession())}>
            Try opening saved trip again
          </button>
        </div>
      )}
      <Routes>
        <Route path="/services" element={<ServiceCatalogPage />} />
        <Route path="/services/:serviceId" element={<ServiceDetailsPage />} />
        <Route path="/bookings" element={<MyBookingsPage />} />
        <Route path="/bookings/:bookingId" element={<BookingDetailsPage />} />
        <Route
          path="*"
          element={
            <p>
              Page not found. <Link to="/services">Browse services</Link>
            </p>
          }
        />
      </Routes>
    </main>
  );
}
