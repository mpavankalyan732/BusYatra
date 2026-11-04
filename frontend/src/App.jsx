import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import SeatSelectionPage from './pages/SeatSelectionPage';
import PassengersPage from './pages/PassengersPage';
import SummaryPage from './pages/SummaryPage';
import PaymentPage from './pages/PaymentPage';
import BookingPage from './pages/BookingPage';
import ManagePage from './pages/ManagePage';
import VerifyTicketPage from './pages/VerifyTicketPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminBookings from './pages/admin/AdminBookings';
import { AdminBuses, AdminRoutes, AdminSchedules } from './pages/admin/AdminCatalog';
import { EmptyState } from './components/ui';

export default function App() {
  const location = useLocation();
  // Braces matter: newer browsers return a Promise from scrollTo, which React rejects as an effect cleanup.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);
  // Animate per top-level section so admin sub-navigation doesn't re-animate the whole shell
  const key = location.pathname.startsWith('/admin') ? '/admin' : location.pathname;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <AnimatePresence mode="wait">
          <Routes location={location} key={key}>
            <Route path="/" element={<HomePage />} />
            <Route path="/buses" element={<SearchPage />} />
            <Route path="/book/:scheduleId/seats" element={<SeatSelectionPage />} />
            <Route path="/book/passengers" element={<PassengersPage />} />
            <Route path="/book/summary" element={<SummaryPage />} />
            <Route path="/book/payment" element={<PaymentPage />} />
            <Route path="/booking/:code" element={<BookingPage />} />
            <Route path="/manage" element={<ManagePage />} />
            <Route path="/verify/:token" element={<VerifyTicketPage />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="buses" element={<AdminBuses />} />
              <Route path="routes" element={<AdminRoutes />} />
              <Route path="schedules" element={<AdminSchedules />} />
            </Route>
            <Route path="*" element={<div className="container-page py-12"><EmptyState title="Page not found">The page you're looking for doesn't exist.</EmptyState></div>} />
          </Routes>
        </AnimatePresence>
      </div>
      <Footer />
      <Toaster position="top-center" toastOptions={{ style: { borderRadius: '14px', fontWeight: 600, fontSize: '14px' } }} />
    </div>
  );
}
