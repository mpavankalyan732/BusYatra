import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import App from './App';
import ErrorBoundary from './components/layout/ErrorBoundary';
import { BookingProvider } from './context/BookingContext';
import './index.css';

// StrictMode is intentionally omitted: its double-invoked effects would open two
// agent chat sessions / seat-lock calls in development.
ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <MotionConfig reducedMotion="user">
        <BookingProvider>
          <App />
        </BookingProvider>
      </MotionConfig>
    </BrowserRouter>
  </ErrorBoundary>,
);
