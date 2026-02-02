import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
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
  RefreshCcw,
  User,
  Star,
  Repeat,
  Sparkles,
  ChevronRight,
  Pause,
  Play,
  List,
  Grid3X3,
  ChevronLeft,
  Home,
  CreditCard
} from 'lucide-react';
import SubscriptionManager from '../components/subscription/SubscriptionManager';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DashboardPage = () => {
  const { user, token, getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [sortBy, setSortBy] = useState('date-asc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Modal states
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

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

  const fetchSubscriptions = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/subscriptions/`, {
        headers: getAuthHeaders()
      });
      setSubscriptions(response.data);
    } catch (error) {
      console.log('No subscriptions or error fetching:', error);
      setSubscriptions([]);
    }
  }, [getAuthHeaders]);

  // WebSocket for real-time updates on customer bookings
  useWebSocket('/api/ws/customer', {
    token,
    autoConnect: !!user,
    autoReconnect: true,
    onMessage: (data) => {
      console.log('Customer WebSocket message:', data);

      // Handle booking-related events
      if (data.type === 'job.assigned') {
        toast.success('A cleaner has been assigned to your booking!');
        fetchBookings();
      } else if (data.type === 'job.started') {
        toast.info('Your cleaning has started!');
        fetchBookings();
      } else if (data.type === 'job.completed') {
        toast.success('Your cleaning is complete!');
        fetchBookings();
      } else if (data.type === 'job.cancelled') {
        toast.warning('A booking has been cancelled');
        fetchBookings();
      }
    }
  });

  useEffect(() => {
    fetchBookings();
    fetchSubscriptions();

    // Polling backup for constant updates (every 10s)
    const interval = setInterval(() => {
      fetchBookings();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchBookings, fetchSubscriptions]);

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

  const handleSubmitReview = async () => {
    if (!reviewModal) return;

    setReviewLoading(true);
    try {
      await axios.post(`${API}/reviews/`, {
        booking_id: reviewModal.id,
        overall_rating: reviewRating,
        comment: reviewComment || null
      }, {
        headers: getAuthHeaders()
      });
      toast.success('Thank you for your review!');
      setReviewModal(null);
      setReviewRating(5);
      setReviewComment('');
      fetchBookings(); // Refresh to update has_review flag
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to submit review'));
    } finally {
      setReviewLoading(false);
    }
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

  // Handle re-booking with service pre-selection
  const handleRebook = (booking) => {
    // Navigate to booking page with pre-selected service info
    navigate('/booking', {
      state: {
        rebookFrom: {
          serviceName: booking.service_name,
          address: booking.address,
          city: booking.city,
          propertyType: booking.property_type,
          bedrooms: booking.bedrooms,
          bathrooms: booking.bathrooms
        }
      }
    });
  };

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
  };

  const getBookingsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return bookings.filter(b => b.scheduled_date === dateStr);
  };

  const formatMonthYear = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const navigateMonth = (direction) => {
    setCalendarMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  // Calendar View Component
  const CalendarView = () => {
    const { daysInMonth, startingDay } = getDaysInMonth(calendarMonth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-stone-50/50" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
      const dayBookings = getBookingsForDate(currentDate);
      const isToday = currentDate.getTime() === today.getTime();
      const isPast = currentDate < today;

      days.push(
        <div
          key={day}
          className={`h-24 md:h-28 border-t border-stone-200 p-1 md:p-2 transition-colors ${isToday ? 'bg-lime-50/50' : isPast ? 'bg-stone-50/30' : 'bg-white hover:bg-stone-50'
            }`}
        >
          <div className={`text-sm font-medium mb-1 ${isToday ? 'text-lime-700 font-bold' : isPast ? 'text-stone-400' : 'text-stone-700'
            }`}>
            {day}
            {isToday && <span className="ml-1 text-xs text-lime-600">(Today)</span>}
          </div>
          <div className="space-y-1 overflow-y-auto max-h-16">
            {dayBookings.map((booking) => (
              <div
                key={booking.id}
                className={`text-xs p-1 rounded truncate cursor-pointer transition-all hover:scale-[1.02] ${booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                  booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    booking.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-lime-100 text-lime-800'
                  }`}
                title={`${booking.service_name} - ${booking.scheduled_time}`}
              >
                <span className="hidden md:inline">{booking.scheduled_time} - </span>
                {booking.service_name.length > 12
                  ? booking.service_name.substring(0, 12) + '...'
                  : booking.service_name}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Calendar Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200 bg-gradient-to-r from-green-50 to-lime-50">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 hover:bg-white rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-stone-600" />
          </button>
          <h3 className="font-heading text-lg font-semibold text-green-900">
            {formatMonthYear(calendarMonth)}
          </h3>
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 hover:bg-white rounded-full transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-stone-600" />
          </button>
        </div>

        {/* Week Days Header */}
        <div className="grid grid-cols-7 bg-stone-100">
          {weekDays.map((day) => (
            <div key={day} className="py-2 text-center text-xs font-medium text-stone-600">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {days}
        </div>

        {/* Legend */}
        <div className="p-3 border-t border-stone-200 bg-stone-50 flex flex-wrap gap-3 justify-center text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-lime-100 border border-lime-300" />
            <span className="text-stone-600">Scheduled</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300" />
            <span className="text-stone-600">In Progress</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
            <span className="text-stone-600">Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-100 border border-red-300" />
            <span className="text-stone-600">Cancelled</span>
          </div>
        </div>
      </div>
    );
  };

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
          {/* Cleaner Info */}
          {booking.cleaner_name && (
            <div className="mt-2 px-3 py-2 bg-lime-50 rounded-lg inline-flex items-center gap-2">
              <User className="w-4 h-4 text-lime-700" />
              <span className="text-sm font-medium text-lime-800">
                Cleaner: {booking.cleaner_name}
              </span>
            </div>
          )}
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
            <div className="flex items-center gap-2">
              {!booking.has_review && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReviewModal(booking)}
                  className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                  data-testid={`rate-${booking.id}`}
                >
                  <Star className="w-4 h-4 mr-1" />
                  Rate
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRebook(booking)}
                className="bg-gradient-to-r from-lime-50 to-green-50 border-lime-200 hover:border-lime-300 hover:from-lime-100 hover:to-green-100"
                data-testid={`rebook-${booking.id}`}
              >
                <RefreshCcw className="w-4 h-4 mr-1 text-lime-600" />
                Book Again
              </Button>
            </div>
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

              {/* Subscription Section */}
              <div className="mb-10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading text-xl font-semibold text-green-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                    Your Subscription
                  </h2>
                  <Link to="/booking" state={{ defaultMode: 'multiple' }} className="text-lime-600 hover:text-lime-700 text-sm font-medium flex items-center gap-1">
                    View Plans <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <SubscriptionManager onRefresh={fetchBookings} />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="stats-card group hover:border-green-200 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-stone-500 text-sm">Total Bookings</p>
                    <CalendarDays className="w-4 h-4 text-stone-300 group-hover:text-green-500 transition-colors" />
                  </div>
                  <p className="font-heading text-3xl font-bold text-green-950">{bookings.length}</p>
                </div>
                <div className="stats-card group hover:border-blue-200 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-stone-500 text-sm">Upcoming</p>
                    <Clock className="w-4 h-4 text-stone-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <p className="font-heading text-3xl font-bold text-blue-600">{upcomingBookings.length}</p>
                </div>
                <div className="stats-card group hover:border-lime-200 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-stone-500 text-sm">Completed</p>
                    <Star className="w-4 h-4 text-stone-300 group-hover:text-lime-500 transition-colors" />
                  </div>
                  <p className="font-heading text-3xl font-bold text-lime-600">
                    {bookings.filter(b => b.status === 'completed').length}
                  </p>
                </div>
                <div className="stats-card group hover:border-amber-200 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-stone-500 text-sm">Total Spent</p>
                    <Sparkles className="w-4 h-4 text-stone-300 group-hover:text-amber-500 transition-colors" />
                  </div>
                  <p className="font-heading text-3xl font-bold text-green-950">
                    ${bookings.filter(b => b.payment_status === 'paid').reduce((sum, b) => sum + Number(b.total_price || 0), 0).toFixed(0)}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
                <Link to="/booking" className="group">
                  <div className="bg-gradient-to-br from-lime-50 to-green-50 border border-lime-200 rounded-xl p-4 text-center hover:shadow-md hover:border-lime-300 transition-all">
                    <div className="w-10 h-10 mx-auto mb-2 bg-lime-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus className="w-5 h-5 text-lime-600" />
                    </div>
                    <p className="text-sm font-medium text-green-900">New Booking</p>
                  </div>
                </Link>
                <Link to="/profile" className="group">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 text-center hover:shadow-md hover:border-blue-300 transition-all">
                    <div className="w-10 h-10 mx-auto mb-2 bg-blue-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-sm font-medium text-blue-900">My Profile</p>
                  </div>
                </Link>
                <Link to="/booking" state={{ defaultMode: 'multiple' }} className="group">
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4 text-center hover:shadow-md hover:border-purple-300 transition-all">
                    <div className="w-10 h-10 mx-auto mb-2 bg-purple-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Repeat className="w-5 h-5 text-purple-600" />
                    </div>
                    <p className="text-sm font-medium text-purple-900">Subscriptions</p>
                  </div>
                </Link>
                <Link to="/services" className="group">
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 text-center hover:shadow-md hover:border-amber-300 transition-all">
                    <div className="w-10 h-10 mx-auto mb-2 bg-amber-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Home className="w-5 h-5 text-amber-600" />
                    </div>
                    <p className="text-sm font-medium text-amber-900">Our Services</p>
                  </div>
                </Link>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <TabsList className="bg-stone-100 p-1 rounded-full mb-8">
                    <TabsTrigger
                      value="upcoming"
                      className="rounded-full data-[state=active]:bg-white data-[state=active]:text-green-950 data-[state=active]:shadow-sm px-6 py-2 transition-all"
                    >
                      <CalendarDays className="w-4 h-4 mr-2" />
                      Upcoming ({upcomingBookings.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="past"
                      className="rounded-full data-[state=active]:bg-white data-[state=active]:text-green-950 data-[state=active]:shadow-sm px-6 py-2 transition-all"
                    >
                      <History className="w-4 h-4 mr-2" />
                      Past ({pastBookings.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* Filters and View Toggle */}
                  <div className="flex items-center gap-3">
                    {/* View Toggle */}
                    <div className="flex items-center bg-stone-100 rounded-full p-1">
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-full transition-all ${viewMode === 'list'
                          ? 'bg-white shadow-sm text-green-900'
                          : 'text-stone-500 hover:text-stone-700'
                          }`}
                        title="List View"
                      >
                        <List className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('calendar')}
                        className={`p-2 rounded-full transition-all ${viewMode === 'calendar'
                          ? 'bg-white shadow-sm text-green-900'
                          : 'text-stone-500 hover:text-stone-700'
                          }`}
                        title="Calendar View"
                      >
                        <Grid3X3 className="w-4 h-4" />
                      </button>
                    </div>

                    {viewMode === 'list' && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>

                {/* Calendar View - Shows all bookings */}
                {viewMode === 'calendar' ? (
                  <div className="mt-6">
                    <CalendarView />
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </Tabs>
            </>
          )}
        </div>
      </main >

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

      {/* Review Modal */}
      <ConfirmationModal
        open={!!reviewModal}
        onOpenChange={(open) => !open && setReviewModal(null)}
        title="Rate Your Cleaning"
        description="How was your experience? Your feedback helps us improve."
        confirmText="Submit Review"
        cancelText="Cancel"
        onConfirm={handleSubmitReview}
        loading={reviewLoading}
        variant="default"
      >
        {reviewModal && (
          <div className="space-y-4 py-2">
            <div className="bg-stone-50 rounded-xl p-4">
              <p className="font-medium text-green-900 mb-1">{reviewModal.service_name}</p>
              <p className="text-stone-600 text-sm">
                {reviewModal.scheduled_date} at {reviewModal.scheduled_time}
              </p>
              {reviewModal.cleaner_name && (
                <p className="text-lime-700 text-sm mt-1">
                  Cleaner: {reviewModal.cleaner_name}
                </p>
              )}
            </div>

            {/* Star Rating */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className={`p-1 transition-colors ${star <= reviewRating
                    ? 'text-amber-400'
                    : 'text-stone-300 hover:text-amber-200'
                    }`}
                >
                  <Star className="w-8 h-8 fill-current" />
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-stone-500">
              {reviewRating === 5 ? 'Excellent!' :
                reviewRating === 4 ? 'Very Good' :
                  reviewRating === 3 ? 'Good' :
                    reviewRating === 2 ? 'Fair' : 'Poor'}
            </p>

            {/* Comment */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Comments (optional)
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience..."
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                rows={3}
              />
            </div>
          </div>
        )}
      </ConfirmationModal>
    </div >
  );
};

export default DashboardPage;
