import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import {
  X,
  Calendar,
  Clock,
  Loader2,
  AlertTriangle,
  CalendarX2,
  Sparkles,
  Info,
  Check
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CancelVisitModal = ({
  visit,
  subscriptionId,
  maxRollover = 4,
  currentRollover = 0,
  onClose,
  onSuccess
}) => {
  const { getAuthHeaders } = useAuth();
  const [reason, setReason] = useState('');
  const [rollover, setRollover] = useState(true);
  const [loading, setLoading] = useState(false);

  if (!visit) return null;

  const canRollover = currentRollover < maxRollover;
  const rolloverAfterCancel = canRollover && rollover ? currentRollover + 1 : currentRollover;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    try {
      const response = await axios.put(
        `${API}/subscriptions/me/visits/${visit.id}/cancel`,
        {
          reason: reason || null,
          rollover: rollover && canRollover
        },
        { headers: getAuthHeaders() }
      );

      toast.success(response.data.message || 'Visit cancelled successfully');
      onSuccess();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to cancel visit';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const cancellationReasons = [
    'Schedule conflict',
    'Out of town',
    'Not feeling well',
    'Property not ready',
    'Weather concerns',
    'Other'
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <CalendarX2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-semibold text-green-900">
                Cancel Visit
              </h2>
              <p className="text-sm text-stone-500">Visit #{visit.visit_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {/* Visit Details */}
        <div className="px-6 py-4 bg-stone-50 border-b border-stone-200">
          <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Scheduled Visit</p>
          <div className="flex items-center gap-4 text-sm text-stone-700">
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
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Rollover Option */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-stone-700">
              What happens to this visit?
            </label>

            {/* Rollover Option */}
            <button
              type="button"
              onClick={() => canRollover && setRollover(true)}
              disabled={!canRollover}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                rollover && canRollover
                  ? 'border-purple-500 bg-purple-50'
                  : canRollover
                  ? 'border-stone-200 hover:border-purple-200 hover:bg-purple-50/50'
                  : 'border-stone-200 bg-stone-50 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  rollover && canRollover
                    ? 'border-purple-500 bg-purple-500'
                    : 'border-stone-300'
                }`}>
                  {rollover && canRollover && <Check className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-green-900">Rollover to next cycle</span>
                    <Sparkles className="w-4 h-4 text-purple-500" />
                  </div>
                  <p className="text-sm text-stone-600 mt-1">
                    Save this visit and use it later. You'll have {rolloverAfterCancel} rollover visit{rolloverAfterCancel !== 1 ? 's' : ''} available.
                  </p>
                  {!canRollover && (
                    <p className="text-xs text-red-600 mt-1">
                      Maximum rollover limit ({maxRollover}) reached
                    </p>
                  )}
                </div>
              </div>
            </button>

            {/* Forfeit Option */}
            <button
              type="button"
              onClick={() => setRollover(false)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                !rollover
                  ? 'border-red-500 bg-red-50'
                  : 'border-stone-200 hover:border-red-200 hover:bg-red-50/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  !rollover
                    ? 'border-red-500 bg-red-500'
                    : 'border-stone-300'
                }`}>
                  {!rollover && <Check className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <span className="font-medium text-green-900">Forfeit this visit</span>
                  <p className="text-sm text-stone-600 mt-1">
                    Cancel without saving. This visit credit will be lost.
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Reason for cancellation
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {cancellationReasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`py-2 px-3 text-sm rounded-lg border transition-all ${
                    reason === r
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {reason === 'Other' && (
              <textarea
                value={reason === 'Other' ? '' : reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please specify..."
                className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                rows={2}
              />
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Cancellation Policy</p>
              <p className="text-amber-700">
                {visit.can_cancel
                  ? 'You can cancel this visit at least 24 hours before the scheduled time.'
                  : 'This visit is within 24 hours and cannot be cancelled.'}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
            <h4 className="text-sm font-medium text-stone-700 mb-2">Summary</h4>
            <div className="space-y-1 text-sm text-stone-600">
              <div className="flex justify-between">
                <span>Visit credit</span>
                <span className={rollover && canRollover ? 'text-purple-600 font-medium' : 'text-red-600'}>
                  {rollover && canRollover ? 'Saved (Rollover)' : 'Lost'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Rollover visits after</span>
                <span className="font-medium">{rolloverAfterCancel}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-full"
              disabled={loading}
            >
              Keep Visit
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="flex-1 rounded-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Confirm Cancel'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CancelVisitModal;
