import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  Repeat,
  ChevronRight,
  AlertCircle,
  CalendarClock,
  CalendarX2,
  Loader2,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  RefreshCcw,
  ArrowRightLeft
} from 'lucide-react';
import RescheduleVisitModal from './RescheduleVisitModal';
import CancelVisitModal from './CancelVisitModal';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SubscriptionManager = ({ onRefresh }) => {
  const { getAuthHeaders } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API}/subscriptions/me`, {
        headers: getAuthHeaders()
      });
      setSubscription(response.data);
    } catch (err) {
      if (err.response?.status === 404) {
        // No active subscription
        setSubscription(null);
      } else {
        console.error('Failed to fetch subscription:', err);
        setError('Failed to load subscription details');
      }
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const handleRescheduleSuccess = () => {
    setRescheduleModal(null);
    fetchSubscription();
    if (onRefresh) onRefresh();
  };

  const handleCancelSuccess = () => {
    setCancelModal(null);
    fetchSubscription();
    if (onRefresh) onRefresh();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusIcon = (visit) => {
    if (visit.is_cancelled) return <XCircle className="w-4 h-4 text-red-500" />;
    if (visit.is_used) return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    return <Clock className="w-4 h-4 text-amber-500" />;
  };

  const getStatusText = (visit) => {
    if (visit.is_cancelled) return 'Cancelled';
    if (visit.is_used) return 'Completed';
    return 'Scheduled';
  };

  const getStatusColor = (visit) => {
    if (visit.is_cancelled) return 'bg-red-100 text-red-700';
    if (visit.is_used) return 'bg-green-100 text-green-700';
    return 'bg-amber-100 text-amber-700';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-4" />
        <p className="text-stone-600">Loading subscription...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
        <p className="text-stone-600 mb-4">{error}</p>
        <Button onClick={fetchSubscription} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="bg-gradient-to-r from-lime-50 to-green-50 border border-lime-200 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-lime-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Repeat className="w-6 h-6 text-lime-600" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-semibold text-green-950 mb-1">
                No Active Subscription
              </h3>
              <p className="text-stone-600 text-sm">
                Subscribe to regular cleaning and save up to 20%. Get priority booking, rollover visits, and flexible scheduling.
              </p>
            </div>
          </div>
          <Button className="bg-lime-500 hover:bg-lime-600 text-white rounded-full whitespace-nowrap">
            <Sparkles className="w-4 h-4 mr-2" />
            View Plans
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subscription Overview Card */}
      <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-2xl p-6 text-white">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          {/* Left: Subscription Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-green-300 text-sm">#{subscription.subscription_number}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                subscription.status === 'active' ? 'bg-lime-500/20 text-lime-300' :
                subscription.status === 'paused' ? 'bg-yellow-500/20 text-yellow-300' :
                'bg-red-500/20 text-red-300'
              }`}>
                {subscription.status === 'active' ? (
                  <span className="flex items-center gap-1"><Play className="w-3 h-3" /> Active</span>
                ) : subscription.status === 'paused' ? (
                  <span className="flex items-center gap-1"><Pause className="w-3 h-3" /> Paused</span>
                ) : subscription.status}
              </span>
            </div>
            <h3 className="font-heading text-2xl font-bold mb-1">{subscription.plan_name}</h3>
            <p className="text-green-200 text-sm">{subscription.service_name}</p>

            <div className="flex items-center gap-2 mt-3 text-green-200 text-sm">
              <MapPin className="w-4 h-4" />
              <span>{subscription.address_summary}</span>
            </div>
          </div>

          {/* Right: Visit Stats */}
          <div className="flex-shrink-0 bg-white/10 rounded-xl p-4 min-w-[200px]">
            <div className="text-center mb-3">
              <p className="text-green-200 text-xs uppercase tracking-wide">Visits Remaining</p>
              <p className="text-4xl font-bold">{subscription.visits_remaining}</p>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-green-200 mb-1">
                <span>Used</span>
                <span>{subscription.visits_used} / {subscription.visits_allocated}</span>
              </div>
              <div className="h-2 bg-green-700/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-lime-400 rounded-full transition-all"
                  style={{ width: `${(subscription.visits_used / subscription.visits_allocated) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-green-200">Rollover</span>
              <span className="flex items-center gap-1 text-lime-300 font-medium">
                <Sparkles className="w-3 h-3" />
                +{subscription.rollover_visits}
              </span>
            </div>
          </div>
        </div>

        {/* Billing Info */}
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-green-300">Next Billing</span>
              <p className="font-medium">{formatDate(subscription.next_billing_date)}</p>
            </div>
            <div>
              <span className="text-green-300">Monthly Price</span>
              <p className="font-medium">${parseFloat(subscription.monthly_price).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Visits Section */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50">
          <h3 className="font-heading text-lg font-semibold text-green-900 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-emerald-600" />
            Upcoming Visits
          </h3>
          <p className="text-sm text-stone-500 mt-1">
            Manage your scheduled cleaning visits. You can reschedule or cancel up to 24 hours before.
          </p>
        </div>

        {subscription.upcoming_visits && subscription.upcoming_visits.length > 0 ? (
          <div className="divide-y divide-stone-100">
            {subscription.upcoming_visits.map((visit) => (
              <div
                key={visit.id}
                className={`p-4 hover:bg-stone-50 transition-colors ${
                  visit.is_cancelled ? 'opacity-60' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Visit Info */}
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      visit.is_cancelled ? 'bg-red-100' :
                      visit.is_used ? 'bg-green-100' :
                      'bg-emerald-100'
                    }`}>
                      <span className={`text-sm font-bold ${
                        visit.is_cancelled ? 'text-red-600' :
                        visit.is_used ? 'text-green-600' :
                        'text-emerald-600'
                      }`}>
                        #{visit.visit_number}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-green-900">
                          {visit.service_name || subscription.service_name}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(visit)}`}>
                          {getStatusIcon(visit)}
                          {getStatusText(visit)}
                        </span>
                        {visit.is_rollover && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 flex items-center gap-1">
                            <ArrowRightLeft className="w-3 h-3" />
                            Rollover
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(visit.scheduled_date)}
                        </span>
                        {visit.scheduled_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {visit.scheduled_time}
                          </span>
                        )}
                        {visit.reschedule_count > 0 && (
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <RefreshCcw className="w-3 h-3" />
                            Rescheduled {visit.reschedule_count}x
                          </span>
                        )}
                      </div>

                      {visit.booking_number && (
                        <p className="text-xs text-stone-400 mt-1">
                          Booking: #{visit.booking_number}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {!visit.is_cancelled && !visit.is_used && (
                    <div className="flex items-center gap-2 ml-13 sm:ml-0">
                      {visit.can_reschedule && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRescheduleModal(visit)}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                        >
                          <CalendarClock className="w-4 h-4 mr-1" />
                          Reschedule
                        </Button>
                      )}
                      {visit.can_cancel && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCancelModal(visit)}
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                        >
                          <CalendarX2 className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                      {!visit.can_reschedule && !visit.can_cancel && (
                        <span className="text-xs text-stone-400 bg-stone-100 px-3 py-1.5 rounded-full">
                          Cannot modify within 24h
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <CalendarClock className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-600 font-medium mb-1">No upcoming visits</p>
            <p className="text-sm text-stone-500">
              Schedule your next cleaning visit to see it here.
            </p>
          </div>
        )}
      </div>

      {/* Rollover Info */}
      {subscription.rollover_visits > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h4 className="font-medium text-purple-900">
                You have {subscription.rollover_visits} rollover visit{subscription.rollover_visits > 1 ? 's' : ''}!
              </h4>
              <p className="text-sm text-purple-700 mt-1">
                These visits were carried over from your previous billing cycle.
                Use them before your next billing date or they may expire.
                Maximum rollover: {subscription.max_rollover_visits} visits.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <RescheduleVisitModal
        visit={rescheduleModal}
        subscriptionId={subscription?.id}
        onClose={() => setRescheduleModal(null)}
        onSuccess={handleRescheduleSuccess}
      />

      <CancelVisitModal
        visit={cancelModal}
        subscriptionId={subscription?.id}
        maxRollover={subscription?.max_rollover_visits}
        currentRollover={subscription?.rollover_visits}
        onClose={() => setCancelModal(null)}
        onSuccess={handleCancelSuccess}
      />
    </div>
  );
};

export default SubscriptionManager;
