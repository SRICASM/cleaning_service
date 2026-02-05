import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  MapPin,
  Pause,
  Play,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  CreditCard,
  Settings,
  RefreshCw
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SubscriptionManagePage = () => {
  const { subscriptionId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [subscription, setSubscription] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    fetchSubscription();
  }, [subscriptionId]);

  useEffect(() => {
    if (subscription) {
      fetchCalendar();
    }
  }, [subscription, currentMonth]);

  const fetchSubscription = async () => {
    try {
      const response = await axios.get(`${API}/subscriptions/${subscriptionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubscription(response.data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      toast.error('Failed to load subscription');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendar = async () => {
    try {
      const response = await axios.get(
        `${API}/subscriptions/${subscriptionId}/calendar?month=${currentMonth}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCalendar(response.data);
    } catch (error) {
      console.error('Error fetching calendar:', error);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await axios.post(
        `${API}/subscriptions/${subscriptionId}/pause`,
        { reason: pauseReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Subscription paused successfully');
      setShowPauseModal(false);
      fetchSubscription();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to pause subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      await axios.post(
        `${API}/subscriptions/${subscriptionId}/resume`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Subscription resumed successfully');
      fetchSubscription();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to resume subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await axios.post(
        `${API}/subscriptions/${subscriptionId}/cancel?immediate=false`,
        { reason: cancelReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Subscription will be cancelled at end of billing cycle');
      setShowCancelModal(false);
      fetchSubscription();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScheduleVisit = (suggestedSlot) => {
    // Navigate to scheduling with pre-filled date
    navigate(`/subscriptions/${subscriptionId}/schedule?date=${suggestedSlot.date}&time=${encodeURIComponent(suggestedSlot.time_slot)}`);
  };

  const changeMonth = (direction) => {
    const date = new Date(currentMonth + '-01');
    date.setMonth(date.getMonth() + direction);
    setCurrentMonth(date.toISOString().slice(0, 7));
  };

  const getStatusBadge = (status) => {
    const config = {
      active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
      paused: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Paused' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
      payment_failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Payment Failed' },
      pending_activation: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Pending Activation' },
    };
    const s = config[status] || config.active;
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <div className="pt-32 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-900"></div>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />

      <div className="pt-24 pb-12">
        <div className="max-w-6xl mx-auto px-4 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link to="/dashboard" className="text-stone-500 hover:text-green-900 flex items-center gap-1 mb-4">
              <ChevronLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-green-900">
                  {subscription.plan.name}
                </h1>
                <p className="text-stone-500">Subscription #{subscription.subscription_number}</p>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(subscription.status)}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Visit Summary Card */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-green-900 mb-4">Visit Summary</h2>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-emerald-50 rounded-xl p-4">
                    <p className="text-3xl font-bold text-emerald-600">{subscription.visits_remaining}</p>
                    <p className="text-sm text-stone-500">Remaining</p>
                  </div>
                  <div className="bg-stone-50 rounded-xl p-4">
                    <p className="text-3xl font-bold text-stone-700">{subscription.visits_used}</p>
                    <p className="text-sm text-stone-500">Used</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-3xl font-bold text-blue-600">{subscription.rollover_visits}</p>
                    <p className="text-sm text-stone-500">Rollover</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-stone-500 mb-1">
                    <span>{subscription.visits_used} of {subscription.visits_allocated} visits used</span>
                    <span>{Math.round((subscription.visits_used / subscription.visits_allocated) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${(subscription.visits_used / subscription.visits_allocated) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Upcoming Schedule */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-green-900">Schedule</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changeMonth(-1)}
                      className="p-1 hover:bg-stone-100 rounded"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-medium min-w-[120px] text-center">
                      {new Date(currentMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => changeMonth(1)}
                      className="p-1 hover:bg-stone-100 rounded"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {calendar ? (
                  <div className="space-y-4">
                    {/* Scheduled Visits */}
                    {calendar.scheduled_visits.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-stone-500 mb-2">Scheduled Visits</h3>
                        <div className="space-y-2">
                          {calendar.scheduled_visits.map((visit) => (
                            <div
                              key={visit.visit_id}
                              className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                  <Check className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-green-900">
                                    {new Date(visit.scheduled_date).toLocaleDateString('en-US', {
                                      weekday: 'short',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </p>
                                  <p className="text-sm text-stone-500">Visit #{visit.visit_number}</p>
                                </div>
                              </div>
                              <span className={`text-sm ${visit.is_used ? 'text-emerald-600' : 'text-blue-600'}`}>
                                {visit.is_used ? 'Completed' : 'Upcoming'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested Slots */}
                    {calendar.suggested_slots.length > 0 && subscription.status === 'active' && (
                      <div>
                        <h3 className="text-sm font-medium text-stone-500 mb-2">Suggested Times</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {calendar.suggested_slots.slice(0, 4).map((slot, index) => (
                            <button
                              key={index}
                              onClick={() => handleScheduleVisit(slot)}
                              disabled={!slot.is_available}
                              className={`p-3 rounded-lg text-left transition-all ${
                                slot.is_available
                                  ? 'bg-white border-2 border-stone-200 hover:border-emerald-500'
                                  : 'bg-stone-100 opacity-50 cursor-not-allowed'
                              }`}
                            >
                              <p className="font-medium text-green-900">
                                {new Date(slot.date).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </p>
                              <p className="text-sm text-stone-500">{slot.time_slot}</p>
                              {slot.is_preferred && (
                                <span className="text-xs text-emerald-600">Preferred</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {calendar.visits_remaining === 0 && (
                      <div className="text-center py-6 text-stone-500">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-stone-400" />
                        <p>All visits have been scheduled this month</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-900"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Subscription Details */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-green-900 mb-4">Details</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-stone-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-stone-500">Next Billing</p>
                      <p className="font-medium text-green-900">
                        {new Date(subscription.next_billing_date).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-stone-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-stone-500">Service Address</p>
                      <p className="font-medium text-green-900">{subscription.address.label}</p>
                      <p className="text-sm text-stone-500">{subscription.address.street_address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-stone-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-stone-500">Preferred Time</p>
                      <p className="font-medium text-green-900">
                        {subscription.preferred_time_slot || 'Not set'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CreditCard className="w-5 h-5 text-stone-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-stone-500">Monthly Price</p>
                      <p className="font-medium text-green-900">
                        AED {parseFloat(subscription.plan.monthly_price).toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="font-semibold text-green-900 mb-4">Actions</h2>
                <div className="space-y-3">
                  {subscription.status === 'active' && (
                    <>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => setShowPauseModal(true)}
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        Pause Subscription
                      </Button>
                      <Link to={`/subscriptions/${subscriptionId}/change-plan`}>
                        <Button variant="outline" className="w-full justify-start">
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Change Plan
                        </Button>
                      </Link>
                    </>
                  )}
                  {subscription.status === 'paused' && (
                    <Button
                      className="w-full justify-start bg-emerald-500 hover:bg-emerald-600"
                      onClick={handleResume}
                      disabled={actionLoading}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {actionLoading ? 'Resuming...' : 'Resume Subscription'}
                    </Button>
                  )}
                  <Link to={`/subscriptions/${subscriptionId}/settings`}>
                    <Button variant="outline" className="w-full justify-start">
                      <Settings className="w-4 h-4 mr-2" />
                      Preferences
                    </Button>
                  </Link>
                  {subscription.status !== 'cancelled' && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setShowCancelModal(true)}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel Subscription
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pause Modal */}
      {showPauseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-green-900 mb-4">Pause Subscription</h3>
            <p className="text-stone-600 mb-4">
              Your subscription will be paused and no visits will be scheduled until you resume.
            </p>
            <textarea
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              placeholder="Reason for pausing (optional)"
              className="w-full px-4 py-3 border border-stone-300 rounded-lg mb-4"
              rows={3}
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowPauseModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-yellow-500 hover:bg-yellow-600"
                onClick={handlePause}
                disabled={actionLoading}
              >
                {actionLoading ? 'Pausing...' : 'Pause Subscription'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-red-600 mb-4">Cancel Subscription</h3>
            <p className="text-stone-600 mb-4">
              Your subscription will be cancelled at the end of your current billing cycle.
              You can still use your remaining visits until then.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Help us improve - why are you cancelling? (optional)"
              className="w-full px-4 py-3 border border-stone-300 rounded-lg mb-4"
              rows={3}
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelModal(false)}
              >
                Keep Subscription
              </Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600"
                onClick={handleCancel}
                disabled={actionLoading}
              >
                {actionLoading ? 'Cancelling...' : 'Cancel Subscription'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManagePage;
