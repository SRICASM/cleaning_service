import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ConfirmationModal } from '../components/ui/confirmation-modal';
import { StatusBadge } from '../components/ui/status-badge';
import { DashboardSkeleton } from '../components/ui/skeletons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { getErrorMessage } from '../utils/errorUtils';
import axios from 'axios';
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Edit,
  ArrowUpDown,
  Filter,
  CalendarDays,
  History,
  RefreshCcw
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DashboardPage = () => {
  const { user, getAuthHeaders } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [sortBy, setSortBy] = useState('date-asc');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modal states
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const timeSlots = [
    '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM',
    '04:00 PM', '05:00 PM'
  ];

  const fetchBookings = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/bookings`, {
        headers: getAuthHeaders()
      });
      setBookings(response.data);
    } catch (error) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Check if booking can be modified (more than 30 mins before scheduled time)
  const canModifyBooking = (booking) => {
    const scheduledDateTime = new Date(`${booking.scheduled_date}T${convertTo24Hour(booking.scheduled_time)}`);
    const now = new Date();
    const minutesUntilBooking = (scheduledDateTime - now) / (1000 * 60);
    return minutesUntilBooking > 30;
  };

  const convertTo24Hour = (time12h) => {
    if (!time12h) return '00:00';
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  };

  const handleCancelConfirm = async () => {
    if (!cancelModal) return;

    setCancelLoading(true);
    try {
      await axios.put(`${API}/bookings/${cancelModal.id}/cancel`, {}, {
        headers: getAuthHeaders()
      });
      toast.success('Booking cancelled successfully');
      setCancelModal(null);
      fetchBookings();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to cancel booking'));
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      toast.error('Please select both date and time');
      return;
    }

    setRescheduleLoading(true);
    try {
      const [time, period] = rescheduleTime.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      const scheduledDateTime = new Date(rescheduleDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      await axios.put(`${API}/bookings/${rescheduleModal.id}/reschedule`, {
        new_date: scheduledDateTime.toISOString(),
        reason: 'Customer rescheduled'
      }, {
        headers: getAuthHeaders()
      });
      toast.success('Booking rescheduled successfully');
      setRescheduleModal(null);
      fetchBookings();
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      if (typeof errorDetail === 'string') {
        toast.error(errorDetail);
      } else if (Array.isArray(errorDetail)) {
        toast.error(errorDetail.map(e => e.msg).join(', '));
      } else {
        toast.error('Failed to reschedule booking');
      }
    } finally {
      setRescheduleLoading(false);
    }
  };

  const openRescheduleModal = (booking) => {
    setRescheduleModal(booking);
    setRescheduleDate(booking.scheduled_date);
    setRescheduleTime(booking.scheduled_time);
  };

  // Filter and sort bookings
  const { upcomingBookings, pastBookings } = useMemo(() => {
    const upcoming = bookings.filter(b =>
      ['pending', 'confirmed', 'in_progress'].includes(b.status)
    );
    const past = bookings.filter(b =>
      ['completed', 'cancelled'].includes(b.status)
    );
    return { upcomingBookings: upcoming, pastBookings: past };
  }, [bookings]);

  const sortBookings = (list) => {
    return [...list].sort((a, b) => {
      const dateA = new Date(`${a.scheduled_date}T${convertTo24Hour(a.scheduled_time)}`);
      const dateB = new Date(`${b.scheduled_date}T${convertTo24Hour(b.scheduled_time)}`);

      switch (sortBy) {
        case 'date-asc':
          return dateA - dateB;
        case 'date-desc':
          return dateB - dateA;
        case 'price-asc':
          return (a.total_price || 0) - (b.total_price || 0);
        case 'price-desc':
          return (b.total_price || 0) - (a.total_price || 0);
        default:
          return dateA - dateB;
      }
    });
  };

  const filterBookings = (list) => {
    if (filterStatus === 'all') return list;
    return list.filter(b => b.status === filterStatus);
  };

  const displayedUpcoming = sortBookings(filterBookings(upcomingBookings));
  const displayedPast = sortBookings(filterBookings(pastBookings));

  const BookingCard = ({ booking, isPast = false }) => (
    <div
      className={`booking-card group ${isPast ? 'opacity-80' : ''}`}
      data-testid={`${isPast ? 'past-' : ''}booking-${booking.id}`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-heading text-lg font-semibold text-green-900">
              {booking.service_name}
            </h3>
            <StatusBadge status={booking.status} />
            {booking.payment_status === 'paid' && (
              <StatusBadge status="paid" />
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-stone-600">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {booking.scheduled_date}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {booking.scheduled_time}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {booking.address}, {booking.city}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-heading text-2xl font-bold text-lime-700">
            ${Number(booking.total_price || 0).toFixed(2)}
          </p>
          {!isPast && canModifyBooking(booking) ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openRescheduleModal(booking)}
                className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                data-testid={`reschedule-${booking.id}`}
              >
                <Edit className="w-4 h-4 mr-1" />
                Reschedule
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelModal(booking)}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                data-testid={`cancel-${booking.id}`}
              >
                Cancel
              </Button>
            </>
          ) : !isPast ? (
            <span className="text-xs text-stone-500 bg-stone-100 px-2 py-1 rounded">
              Cannot modify within 30 min
            </span>
          ) : booking.status === 'completed' ? (
            <Link to="/booking">
              <Button variant="outline" size="sm" data-testid={`rebook-${booking.id}`}>
                <RefreshCcw className="w-4 h-4 mr-1" />
                Book Again
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );

  const EmptyState = ({ type }) => (
    <div className="text-center py-16 bg-white rounded-2xl border border-stone-200">
      {type === 'upcoming' ? (
        <CalendarDays className="w-12 h-12 mx-auto text-stone-300 mb-4" />
      ) : (
        <History className="w-12 h-12 mx-auto text-stone-300 mb-4" />
      )}
      <h3 className="font-heading text-lg font-semibold text-green-900 mb-2">
        {type === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
      </h3>
      <p className="text-stone-600 mb-4">
        {type === 'upcoming'
          ? 'Book a cleaning to get started!'
          : 'Your booking history will appear here.'}
      </p>
      {type === 'upcoming' && (
        <Link to="/booking">
          <Button className="bg-lime-500 hover:bg-lime-600 text-white rounded-full">
            <Plus className="w-4 h-4 mr-2" />
            Book a Clean
          </Button>
        </Link>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />

      <main className="pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          {loading ? (
            <DashboardSkeleton />
          ) : (
            <>
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                <div>
                  <h1 className="font-heading text-3xl md:text-4xl font-bold text-green-900">
                    Welcome back, {user?.name?.split(' ')[0]}!
                  </h1>
                  <p className="text-stone-600 mt-1">
                    Manage your bookings and account here.
                  </p>
                </div>
                <Link to="/booking">
                  <Button className="bg-lime-500 hover:bg-lime-600 text-white rounded-full" data-testid="dashboard-new-booking">
                    <Plus className="w-4 h-4 mr-2" />
                    New Booking
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                <div className="stats-card">
                  <p className="text-stone-500 text-sm mb-1">Total Bookings</p>
                  <p className="font-heading text-3xl font-bold text-green-900">{bookings.length}</p>
                </div>
                <div className="stats-card">
                  <p className="text-stone-500 text-sm mb-1">Upcoming</p>
                  <p className="font-heading text-3xl font-bold text-blue-600">{upcomingBookings.length}</p>
                </div>
                <div className="stats-card">
                  <p className="text-stone-500 text-sm mb-1">Completed</p>
                  <p className="font-heading text-3xl font-bold text-lime-600">
                    {bookings.filter(b => b.status === 'completed').length}
                  </p>
                </div>
                <div className="stats-card">
                  <p className="text-stone-500 text-sm mb-1">Total Spent</p>
                  <p className="font-heading text-3xl font-bold text-green-900">
                    ${bookings.filter(b => b.payment_status === 'paid').reduce((sum, b) => sum + Number(b.total_price || 0), 0).toFixed(0)}
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <TabsList className="bg-white border border-stone-200 p-1 rounded-full">
                    <TabsTrigger
                      value="upcoming"
                      className="rounded-full data-[state=active]:bg-green-900 data-[state=active]:text-white px-6"
                    >
                      <CalendarDays className="w-4 h-4 mr-2" />
                      Upcoming ({upcomingBookings.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="past"
                      className="rounded-full data-[state=active]:bg-green-900 data-[state=active]:text-white px-6"
                    >
                      <History className="w-4 h-4 mr-2" />
                      Past ({pastBookings.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* Filters */}
                  <div className="flex items-center gap-3">
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-[160px] rounded-full bg-white">
                        <ArrowUpDown className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date-asc">Date (Earliest)</SelectItem>
                        <SelectItem value="date-desc">Date (Latest)</SelectItem>
                        <SelectItem value="price-asc">Price (Low-High)</SelectItem>
                        <SelectItem value="price-desc">Price (High-Low)</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-[140px] rounded-full bg-white">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <TabsContent value="upcoming" className="space-y-4 mt-6">
                  {displayedUpcoming.length > 0 ? (
                    displayedUpcoming.map((booking) => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))
                  ) : (
                    <EmptyState type="upcoming" />
                  )}
                </TabsContent>

                <TabsContent value="past" className="space-y-4 mt-6">
                  {displayedPast.length > 0 ? (
                    displayedPast.map((booking) => (
                      <BookingCard key={booking.id} booking={booking} isPast />
                    ))
                  ) : (
                    <EmptyState type="past" />
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </main>

      <Footer />

      {/* Reschedule Modal */}
      <ConfirmationModal
        open={!!rescheduleModal}
        onOpenChange={(open) => !open && setRescheduleModal(null)}
        title="Reschedule Booking"
        description={rescheduleModal ? `Reschedule your ${rescheduleModal.service_name} appointment` : ''}
        confirmText="Confirm Reschedule"
        cancelText="Cancel"
        onConfirm={handleReschedule}
        loading={rescheduleLoading}
        variant="default"
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              New Date
            </label>
            <input
              type="date"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              New Time
            </label>
            <select
              value={rescheduleTime}
              onChange={(e) => setRescheduleTime(e.target.value)}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Select a time</option>
              {timeSlots.map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </div>
        </div>
      </ConfirmationModal>

      {/* Cancel Confirmation Modal */}
      <ConfirmationModal
        open={!!cancelModal}
        onOpenChange={(open) => !open && setCancelModal(null)}
        title="Cancel Booking"
        description="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmText="Yes, Cancel Booking"
        cancelText="Keep Booking"
        onConfirm={handleCancelConfirm}
        loading={cancelLoading}
        variant="destructive"
      >
        {cancelModal && (
          <div className="bg-stone-50 rounded-xl p-4 my-2">
            <p className="font-medium text-green-900 mb-1">{cancelModal.service_name}</p>
            <p className="text-stone-600 text-sm">
              {cancelModal.scheduled_date} at {cancelModal.scheduled_time}
            </p>
            <p className="text-stone-500 text-sm">
              {cancelModal.address}, {cancelModal.city}
            </p>
          </div>
        )}
      </ConfirmationModal>
    </div>
  );
};

export default DashboardPage;
