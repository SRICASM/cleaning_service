import React, { useState, useMemo } from 'react';
import { Sun, Sunset, Moon, Check } from 'lucide-react';

const TIME_PERIODS = [
  {
    id: 'morning',
    label: 'Morning',
    icon: Sun,
    description: '7 AM - 12 PM',
    timeRange: { start: 7, end: 12 },
    color: 'amber'
  },
  {
    id: 'afternoon',
    label: 'Afternoon',
    icon: Sunset,
    description: '12 PM - 5 PM',
    timeRange: { start: 12, end: 17 },
    color: 'orange'
  },
  {
    id: 'evening',
    label: 'Evening',
    icon: Moon,
    description: '5 PM - 9 PM',
    timeRange: { start: 17, end: 21 },
    color: 'indigo'
  }
];

// Generate time slots for a period
const generateTimeSlots = (startHour, endHour, interval = 30) => {
  const slots = [];
  let current = startHour * 60; // Convert to minutes
  const end = endHour * 60;

  while (current < end) {
    const hour = Math.floor(current / 60);
    const minute = current % 60;
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 || hour === 12 ? 12 : hour);

    slots.push({
      value: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      display: `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
    });

    current += interval;
  }

  return slots;
};

const TimePeriodSelector = ({
  selectedPeriod,
  selectedTime,
  onPeriodChange,
  onTimeChange,
  showTimeSlots = true,
  selectedDate = null,
  unavailableSlots = []
}) => {
  const [expandedPeriod, setExpandedPeriod] = useState(selectedPeriod || 'morning');

  // Generate time slots for expanded period
  const timeSlots = useMemo(() => {
    const period = TIME_PERIODS.find(p => p.id === expandedPeriod);
    if (!period) return [];
    return generateTimeSlots(period.timeRange.start, period.timeRange.end);
  }, [expandedPeriod]);

  // Check if a time slot is disabled (past time for today)
  const isSlotDisabled = (slotValue) => {
    if (unavailableSlots.includes(slotValue)) return true;
    if (!selectedDate) return false;

    const today = new Date();
    const checkDate = new Date(selectedDate);

    const isToday = checkDate.getDate() === today.getDate() &&
      checkDate.getMonth() === today.getMonth() &&
      checkDate.getFullYear() === today.getFullYear();

    if (!isToday) return false;

    const [hours, minutes] = slotValue.split(':').map(Number);
    const slotTime = new Date();
    slotTime.setHours(hours, minutes, 0, 0);

    // Add 1 hour buffer
    const minTime = new Date(today.getTime() + 60 * 60 * 1000);
    return slotTime < minTime;
  };

  const handlePeriodClick = (periodId) => {
    setExpandedPeriod(periodId);
    if (onPeriodChange) {
      onPeriodChange(periodId);
    }
  };

  const handleTimeClick = (time) => {
    if (isSlotDisabled(time)) return;
    onTimeChange(time);
  };

  return (
    <div className="w-full space-y-4">
      {/* Period Selection */}
      <div>
        <label className="text-sm font-semibold text-green-900 mb-3 block">
          Preferred Time
        </label>

        <div className="grid grid-cols-3 gap-3">
          {TIME_PERIODS.map((period) => {
            const Icon = period.icon;
            const isActive = expandedPeriod === period.id;
            const isSelected = selectedPeriod === period.id;

            return (
              <button
                key={period.id}
                onClick={() => handlePeriodClick(period.id)}
                className={`relative p-4 rounded-xl border-2 transition-all ${
                  isActive
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-stone-200 hover:border-emerald-200 hover:bg-stone-50'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-emerald-500 text-white' : 'bg-stone-100 text-stone-500'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`font-medium text-sm ${isActive ? 'text-green-900' : 'text-stone-600'}`}>
                    {period.label}
                  </span>
                  <span className="text-xs text-stone-400">
                    {period.description}
                  </span>
                </div>

                {isSelected && selectedTime && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slots */}
      {showTimeSlots && (
        <div className="bg-stone-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-stone-700">
              Select specific time
            </span>
            {selectedTime && (
              <span className="text-sm text-emerald-600 font-medium">
                {timeSlots.find(s => s.value === selectedTime)?.display || selectedTime}
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {timeSlots.map((slot) => {
              const isDisabled = isSlotDisabled(slot.value);
              const isSelected = selectedTime === slot.value;

              return (
                <button
                  key={slot.value}
                  onClick={() => handleTimeClick(slot.value)}
                  disabled={isDisabled}
                  className={`py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                    isDisabled
                      ? 'bg-stone-100 text-stone-300 cursor-not-allowed'
                      : isSelected
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'bg-white border border-stone-200 text-stone-700 hover:border-emerald-300 hover:bg-emerald-50'
                  }`}
                >
                  {slot.display}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimePeriodSelector;
export { TIME_PERIODS };
