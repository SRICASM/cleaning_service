import React, { useState, useMemo } from 'react';
import { Sun, Sunset, Moon, Clock, AlertCircle } from 'lucide-react';

// Time periods with 15-minute slot intervals
const TIME_PERIODS = [
  {
    id: 'morning',
    label: 'Morning',
    icon: Sun,
    startHour: 7,
    endHour: 11.75,  // 7:00 AM - 11:45 AM
    color: 'amber'
  },
  {
    id: 'afternoon',
    label: 'Afternoon',
    icon: Sunset,
    startHour: 12,
    endHour: 16.75,  // 12:00 PM - 4:45 PM
    color: 'orange'
  },
  {
    id: 'evening',
    label: 'Evening',
    icon: Moon,
    startHour: 17,
    endHour: 20.75,  // 5:00 PM - 8:45 PM
    color: 'indigo'
  }
];

// Generate 15-minute interval slots
const generateSlots = (startHour, endHour) => {
  const slots = [];
  let current = startHour;

  while (current <= endHour) {
    const hour = Math.floor(current);
    const minute = Math.round((current % 1) * 60);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 || hour === 12 ? 12 : hour);
    const displayMinute = minute.toString().padStart(2, '0');

    slots.push({
      value: `${hour.toString().padStart(2, '0')}:${displayMinute}`,
      display: `${displayHour}:${displayMinute} ${period}`,
      hour24: hour,
      minute
    });

    current += 0.25; // 15 minutes = 0.25 hours
  }

  return slots;
};

const TimeSlotGrid = ({
  selectedTime,
  onSelect,
  selectedDate,
  unavailableSlots = [],
  showAvailability = true,
  bufferMinutes = 60 // Buffer before current time for today
}) => {
  const [activePeriod, setActivePeriod] = useState('morning');

  // Get active period data
  const period = TIME_PERIODS.find(p => p.id === activePeriod);

  // Generate slots for active period
  const slots = useMemo(() => {
    if (!period) return [];
    return generateSlots(period.startHour, period.endHour);
  }, [period]);

  // Check if a slot is disabled (past time or unavailable)
  const isSlotDisabled = (slot) => {
    // Check if slot is in unavailable list
    if (unavailableSlots.includes(slot.value)) {
      return { disabled: true, reason: 'unavailable' };
    }

    if (!selectedDate) {
      return { disabled: true, reason: 'no-date' };
    }

    const today = new Date();
    const checkDate = new Date(selectedDate);

    // Check if selected date is today
    const isToday = checkDate.getDate() === today.getDate() &&
      checkDate.getMonth() === today.getMonth() &&
      checkDate.getFullYear() === today.getFullYear();

    if (!isToday) {
      return { disabled: false };
    }

    // For today, disable past times + buffer
    const slotTime = new Date();
    slotTime.setHours(slot.hour24, slot.minute, 0, 0);

    const minTime = new Date(today.getTime() + bufferMinutes * 60 * 1000);

    if (slotTime < minTime) {
      return { disabled: true, reason: 'past' };
    }

    return { disabled: false };
  };

  // Count available slots per period
  const availableCount = useMemo(() => {
    const counts = {};

    TIME_PERIODS.forEach(p => {
      const periodSlots = generateSlots(p.startHour, p.endHour);
      counts[p.id] = periodSlots.filter(slot => !isSlotDisabled(slot).disabled).length;
    });

    return counts;
  }, [selectedDate, unavailableSlots]);

  return (
    <div className="w-full">
      {/* Period Tabs */}
      <div className="flex p-1 bg-stone-100 rounded-xl mb-4">
        {TIME_PERIODS.map((p) => {
          const Icon = p.icon;
          const isActive = activePeriod === p.id;
          const count = availableCount[p.id];

          return (
            <button
              key={p.id}
              onClick={() => setActivePeriod(p.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 px-2 text-sm font-medium rounded-lg transition-all ${
                isActive
                  ? 'bg-white text-green-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : ''}`} />
                <span>{p.label}</span>
              </div>
              {showAvailability && (
                <span className={`text-xs ${
                  count === 0
                    ? 'text-red-500'
                    : count <= 3
                    ? 'text-amber-500'
                    : 'text-emerald-500'
                }`}>
                  {count} slots
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Time Grid */}
      <div className="grid grid-cols-4 gap-2">
        {slots.map((slot) => {
          const { disabled, reason } = isSlotDisabled(slot);
          const isSelected = selectedTime === slot.value;

          return (
            <button
              key={slot.value}
              onClick={() => !disabled && onSelect(slot.value)}
              disabled={disabled}
              title={reason === 'unavailable' ? 'Not available' : reason === 'past' ? 'Time has passed' : ''}
              className={`relative py-2.5 px-2 rounded-xl text-sm font-medium border transition-all ${
                disabled
                  ? 'border-transparent bg-stone-50 text-stone-300 cursor-not-allowed'
                  : isSelected
                  ? 'border-emerald-500 bg-emerald-500 text-white shadow-md'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              {slot.display}
              {reason === 'unavailable' && !isSelected && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="w-2 h-2 bg-red-400 rounded-full" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* No available slots message */}
      {availableCount[activePeriod] === 0 && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">No slots available</p>
            <p className="text-xs text-amber-600">
              {activePeriod === 'morning'
                ? 'Try afternoon or evening slots'
                : activePeriod === 'afternoon'
                ? 'Try morning or evening slots'
                : 'Try morning or afternoon slots'}
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-stone-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border border-stone-200 bg-white" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-500" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-stone-100" />
          <span>Unavailable</span>
        </div>
      </div>
    </div>
  );
};

export default TimeSlotGrid;
