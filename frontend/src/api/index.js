import { http } from './client';

const data = (p) => p.then((r) => r.data.data);
const tok = (accessToken) => ({ headers: { 'x-access-token': accessToken } });

export const api = {
  health: () => data(http.get('/health')),

  // catalogue
  cities: () => data(http.get('/cities')),
  searchBuses: (params) => data(http.get('/buses/search', { params })),
  bus: (id) => data(http.get(`/buses/${id}`)),
  seats: (id, holdBookingId) => data(http.get(`/buses/${id}/seats`, { params: holdBookingId ? { holdBookingId } : {} })),

  // booking
  lockSeats: (body, accessToken) => data(http.post('/bookings/lock-seats', body, accessToken ? tok(accessToken) : undefined)),
  releaseHold: (bookingId, accessToken) => data(http.delete(`/bookings/${bookingId}/hold`, tok(accessToken))),
  savePassengers: (body, accessToken) => data(http.post('/bookings/passengers', body, tok(accessToken))),
  confirmBooking: (bookingId, accessToken) => data(http.post('/bookings/confirm', { bookingId }, tok(accessToken))),
  booking: (idOrCode, { accessToken, email } = {}) =>
    data(http.get(`/bookings/${idOrCode}`, { params: email ? { email } : {}, ...(accessToken ? tok(accessToken) : {}) })),
  myBookings: () => data(http.get('/bookings/mine')),
  ticketPdf: (idOrCode, { accessToken, email } = {}) =>
    http.get(`/bookings/${idOrCode}/ticket.pdf`, { responseType: 'blob', params: email ? { email } : {}, ...(accessToken ? tok(accessToken) : {}) }).then((r) => r.data),
  verifyTicket: (token) => data(http.get(`/tickets/verify/${token}`)),

  // payments (demo)
  testInstruments: () => data(http.get('/payments/test-instruments')),
  createPayment: (body, accessToken, idempotencyKey) =>
    data(http.post('/payments/create', body, { headers: { 'x-access-token': accessToken, 'Idempotency-Key': idempotencyKey } })),
  verifyPayment: (body, accessToken) => data(http.post('/payments/verify', body, tok(accessToken))),
  verifyUpi: (upiId) => data(http.post('/payments/upi/verify', { upiId })),

  // admin
  admin: {
    stats: () => data(http.get('/admin/stats')),
    bookings: (params) => data(http.get('/admin/bookings', { params })),
    cancel: (id, reason) => data(http.post(`/admin/bookings/${id}/cancel`, { reason })),
    resync: (id) => data(http.post(`/admin/bookings/${id}/resync`)),
    layouts: () => data(http.get('/admin/layouts')),
    buses: () => data(http.get('/admin/buses')),
    createBus: (body) => data(http.post('/admin/buses', body)),
    updateBus: (id, body) => data(http.put(`/admin/buses/${id}`, body)),
    changeLayout: (id, layoutTemplate) => data(http.put(`/admin/buses/${id}/layout`, { layoutTemplate })),
    routes: () => data(http.get('/admin/routes')),
    createRoute: (body) => data(http.post('/admin/routes', body)),
    updateRoute: (id, body) => data(http.put(`/admin/routes/${id}`, body)),
    schedules: (params) => data(http.get('/admin/schedules', { params })),
    recurring: () => data(http.get('/admin/schedules/recurring')),
    createSchedule: (body) => data(http.post('/admin/schedules', body)),
    cancelSchedule: (id) => data(http.post(`/admin/schedules/${id}/cancel`)),
  },
};
