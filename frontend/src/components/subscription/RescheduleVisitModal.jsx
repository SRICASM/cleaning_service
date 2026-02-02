import React, { useState, useEffect } from 'react';
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
  CalendarClock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RescheduleVisitModal = ({ visit, subscriptionId, onClose, onSuccess }) => {
  const { getAuthHeaders } = useAuth();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const timeSlots = [
    '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM',
    '04:00 PM', '05:00 PM'
  ];

  // Reset form when visit changes
  useEffect(() => {
    if (visit?.scheduled_date) {
      const date = new Date(visit.scheduled_date);
      setSelectedDate(date.toISOString().split('T')[0]);
      setCurrentMonth(date);
    }
    setSelectedTime('');
    setReason('');
  }, [visit]);

  if (!visit) return null;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedDate) {
      toast.error('Please select a new date');
      return;
    }

    if (!selectedTime) {
      toast.error('Please select a new time');
      return;
    }

    setLoading(true);

    try {
      // Parse time to create full datetime
      const [time, period] = selectedTime.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      const newDateTime = new Date(selectedDate);
      newDateTime.setHours(hours, minutes, 0, 0);

      await axios.put(
        `${API}/subscriptions/me/visits/${visit.id}/reschedule`,
        {
          new_date: newDateTime.toISOString(),
          new_time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
          reason: reason || null
        },
        { headers: getAuthHeaders() }
      );

      toast.success('Visit rescheduled successfully!');
      onSuccess();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to reschedule visit';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Calendar helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
      daysInMonth: lastDay.getDate(),
      startingDay: firstDay.getDay(),
      year,
      month
    };
  };

  const isDateDisabled = (day) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Can't select past dates or today (need at least 24h notice)
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() + 1);

    return date < minDate;
  };

  const handleDateSelect = (day) => {
    if (isDateDisabled(day)) return;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  const { daysInMonth, startingDay, year, month } = getDaysInMonth(currentMonth);
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-semibold text-green-900">
                Reschedule Visit
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

        {/* Current Schedule */}
        <div className="px-6 py-4 bg-stone-50 border-b border-stone-200">
          <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Current Schedule</p>
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
          {/* Calendar */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-3">
              Select New Date
            </label>
            <div className="border border-stone-200 rounded-xl overflow-hidden">
              {/* Month Navigation */}
              <div className="flex items-center justify-between p-3 bg-stone-50 border-b border-stone-200">
                <button
                  type="button"
                  onClick={() => navigateMonth(-1)}
                  className="p-1.5 hover:bg-white rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-stone-600" />
                </button>
                <span className="font-medium text-green-900">
                  {monthNames[month]} {year}
                </span>
                <button
                  type="button"
                  onClick={() => navigateMonth(1)}
                  className="p-1.5 hover:bg-white rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-stone-600" />
                </button>
              </div>

              {/* Week Headers */}
              <div className="grid grid-cols-7 bg-stone-50 border-b border-stone-200">
                {weekDays.map((day) => (
                  <div key={day} className="py-2 text-center text-xs font-medium text-stone-500">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 p-2 gap-1">
                {/* Empty cells for days before the first */}
                {Array.from({ length: startingDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-10" />
                ))}

                {/* Days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = new Date(year, month, day).toISOString().split('T')[0];
                  const isSelected = selectedDate === dateStr;
                  const isDisabled = isDateDisabled(day);

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleDateSelect(day)}
                      disabled={isDisabled}
                      className={`h-10 rounded-lg text-sm font-medium transition-all ${
                        isDisabled
                          ? 'text-stone-300 cursor-not-allowed'
                          : isSelected
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'text-stone-700 hover:bg-blue-50 hover:text-blue-700'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Time Selection */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-3">
              Select New Time
            </label>
            <div className="grid grid-cols-5 gap-2">
              {timeSlots.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setSelectedTime(time)}
                  className={`py-2 px-1 text-xs font-medium rounded-lg border transition-all ${
                    selectedTime === time
                      ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                      : 'bg-white text-stone-700 border-stone-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>

          {/* Reason (Optional) */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Reason (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you rescheduling?"
              className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={2}
            />
          </div>

          {/* Warning */}
          {visit.reschedule_count >= 2 && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">Multiple reschedules</p>
                <p className="text-amber-700">
                  This visit has been rescheduled {visit.reschedule_count} times.
                  Please try to keep this appointment.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-full"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-full"
              disabled={loading || !selectedDate || !selectedTime}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rescheduling...
                </>
              ) : (
                'Confirm Reschedule'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RescheduleVisitModal;
