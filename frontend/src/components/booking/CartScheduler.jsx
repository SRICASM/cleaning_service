import React, { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import BookingTimeSelector from './BookingTimeSelector';
import BookingDurationSelector from './BookingDurationSelector';
import { addMonths, format } from 'date-fns';
import {
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Check,
  Sparkles,
  AlertCircle,
  CalendarPlus,
  CalendarDays,
  Repeat,
  CalendarRange
} from 'lucide-react';
import { Button } from '../ui/button';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Scheduling mode options
const SCHEDULE_MODES = [
  { id: 'single', label: 'Single', icon: Calendar, description: 'One-time visit' },
  { id: 'multiple', label: 'Multiple', icon: CalendarDays, description: 'Pick specific dates' },
  { id: 'custom', label: 'Custom', icon: Repeat, description: 'Select days of the week' }
];

// Days of the week
const WEEK_DAYS = [
  { id: 0, short: 'Sun', full: 'Sunday' },
  { id: 1, short: 'Mon', full: 'Monday' },
  { id: 2, short: 'Tue', full: 'Tuesday' },
  { id: 3, short: 'Wed', full: 'Wednesday' },
  { id: 4, short: 'Thu', full: 'Thursday' },
  { id: 5, short: 'Fri', full: 'Friday' },
  { id: 6, short: 'Sat', full: 'Saturday' }
];

// Calendar component with mode support and date range selection
const DatePicker = ({
  selectedDates,
  onDatesReplace,
  mode = 'multiple',
  // Date range for multiple/custom modes
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  // Custom mode props
  selectedDays = [],
  onDaysChange
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { daysInMonth, firstDay, year, month };
  };

  const { daysInMonth, firstDay, year, month } = getDaysInMonth(currentMonth);

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const getDateStr = (day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const isDateSelected = (day) => {
    const dateStr = getDateStr(day);
    return selectedDates.includes(dateStr);
  };

  const isDateDisabled = (day) => {
    const date = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isStartDate = (day) => {
    return startDate === getDateStr(day);
  };

  const isEndDate = (day) => {
    return endDate === getDateStr(day);
  };

  const isInRange = (day) => {
    if (!startDate || !endDate) return false;
    const dateStr = getDateStr(day);
    return dateStr > startDate && dateStr < endDate;
  };

  const handleDateClick = (day) => {
    if (isDateDisabled(day)) return;

    const dateStr = getDateStr(day);

    if (mode === 'single') {
      // Single mode: select one date
      onDatesReplace([dateStr]);
    } else if (mode === 'subscription') {
      // Subscription mode: only select start date, end date is auto-calculated
      if (dateStr === startDate) {
        // Clicking same date clears selection
        onStartDateChange(null);
      } else {
        // Set new start date (end date will be auto-calculated by parent)
        onStartDateChange(dateStr);
      }
    } else {
      // Multiple/Custom mode: select date range manually
      if (!startDate || (startDate && endDate)) {
        // Start new selection
        onStartDateChange(dateStr);
        onEndDateChange(null);
      } else if (dateStr < startDate) {
        // Clicked before start date, make this the new start
        onStartDateChange(dateStr);
      } else if (dateStr === startDate) {
        // Clicked same date, clear selection
        onStartDateChange(null);
        onEndDateChange(null);
      } else {
        // Set end date
        onEndDateChange(dateStr);
      }
    }
  };

  // Handle day-of-week toggle for custom mode
  const handleDayToggle = (dayId) => {
    if (!onDaysChange) return;

    const newDays = selectedDays.includes(dayId)
      ? selectedDays.filter(d => d !== dayId)
      : [...selectedDays, dayId].sort((a, b) => a - b);

    onDaysChange(newDays);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      {/* Custom mode: Days of Week Selector */}
      {mode === 'custom' && (
        <div className="mb-4 pb-4 border-b border-stone-200">
          <p className="text-xs font-medium text-stone-500 mb-3">Select Days of the Week</p>
          <div className="grid grid-cols-7 gap-2">
            {WEEK_DAYS.map(day => {
              const isSelected = selectedDays.includes(day.id);
              return (
                <button
                  key={day.id}
                  onClick={() => handleDayToggle(day.id)}
                  className={`flex flex-col items-center py-2 px-1 rounded-lg border-2 transition-all ${isSelected
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-emerald-200'
                    }`}
                >
                  <span className="text-xs font-semibold">{day.short}</span>
                  {isSelected && <Check className="w-3 h-3 mt-0.5 text-emerald-500" />}
                </button>
              );
            })}
          </div>
          {selectedDays.length > 0 && (
            <p className="text-xs text-emerald-600 mt-2 text-center">
              Every {selectedDays.map(d => WEEK_DAYS.find(wd => wd.id === d)?.short).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Range Selection Instructions */}
      {(mode === 'multiple' || mode === 'custom') && (
        <div className="mb-3 text-center">
          <p className="text-xs text-stone-500">
            {!startDate ? 'Click to select start date' :
              !endDate ? 'Click to select end date' :
                'Date range selected'}
          </p>
        </div>
      )}

      {/* Subscription Mode Instructions */}
      {mode === 'subscription' && (
        <div className="mb-3 text-center">
          <p className="text-xs text-stone-500">
            {!startDate
              ? 'Click to select your subscription start date'
              : 'Subscription period selected (click start date to change)'}
          </p>
        </div>
      )}

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
        >
          <ChevronDown className="w-5 h-5 rotate-90" />
        </button>
        <span className="font-semibold text-green-900">
          {monthNames[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
        >
          <ChevronDown className="w-5 h-5 -rotate-90" />
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map(day => (
          <div key={day} className="text-center text-xs font-medium text-stone-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for days before month starts */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="h-10" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const isSelected = isDateSelected(day);
          const isDisabled = isDateDisabled(day);
          const isStart = isStartDate(day);
          const isEnd = isEndDate(day);
          const inRange = isInRange(day);

          // For single mode, just show selected
          // For multiple/custom/subscription mode, show range highlighting
          let cellClass = 'text-stone-700 hover:bg-emerald-50 hover:text-emerald-700';

          if (isDisabled) {
            cellClass = 'text-stone-300 cursor-not-allowed';
          } else if (mode === 'single' && isSelected) {
            cellClass = 'bg-emerald-500 text-white shadow-md';
          } else if (mode === 'subscription') {
            // Subscription mode: show range but only start is clickable
            if (isStart) {
              cellClass = 'bg-emerald-500 text-white shadow-md ring-2 ring-emerald-300';
            } else if (isEnd) {
              cellClass = 'bg-emerald-400 text-white shadow-sm';
            } else if (inRange) {
              cellClass = 'bg-emerald-100 text-emerald-700';
            }
          } else if (mode !== 'single') {
            if (isStart || isEnd) {
              cellClass = 'bg-emerald-500 text-white shadow-md';
            } else if (inRange) {
              cellClass = 'bg-emerald-100 text-emerald-700';
            } else if (isSelected) {
              cellClass = 'bg-emerald-200 text-emerald-800 ring-1 ring-emerald-400';
            }
          }

          return (
            <button
              key={day}
              onClick={() => handleDateClick(day)}
              disabled={isDisabled}
              className={`h-10 w-full rounded-lg text-sm font-medium transition-all ${cellClass}`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Selected dates display */}
      {selectedDates.length > 0 && (
        <div className="mt-4 pt-4 border-t border-stone-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-stone-500">
              {mode === 'single'
                ? 'Selected Date'
                : mode === 'subscription'
                  ? `${selectedDates.length} visits in subscription period`
                  : `${selectedDates.length} visit${selectedDates.length > 1 ? 's' : ''} scheduled`}
            </p>
            {mode !== 'single' && startDate && endDate && mode !== 'subscription' && (
              <button
                onClick={() => {
                  onStartDateChange(null);
                  onEndDateChange(null);
                }}
                className="text-xs text-red-500 hover:text-red-600"
              >
                Clear
              </button>
            )}
            {mode === 'subscription' && startDate && (
              <button
                onClick={() => {
                  onStartDateChange(null);
                }}
                className="text-xs text-red-500 hover:text-red-600"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
            {selectedDates.slice(0, 10).map((dateStr) => {
              const date = new Date(dateStr);
              return (
                <span
                  key={dateStr}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"
                >
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              );
            })}
            {selectedDates.length > 10 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
                +{selectedDates.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Add-on selector component
const AddOnSelector = ({ selectedAddOns, onToggleAddOn, availableAddOns }) => {
  if (!availableAddOns || availableAddOns.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-sm font-semibold text-green-900 mb-3">Add-Ons (per visit)</p>
      <div className="grid grid-cols-2 gap-2">
        {availableAddOns.map(addon => {
          const isSelected = selectedAddOns.some(a => a.id === addon.id);
          return (
            <button
              key={addon.id}
              onClick={() => onToggleAddOn(addon)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${isSelected
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-stone-200 hover:border-emerald-200'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-800">{addon.name}</span>
                {isSelected && <Check className="w-4 h-4 text-emerald-500" />}
              </div>
              <span className="text-xs text-emerald-600 font-semibold">+${addon.price}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Generate dates between start and end date
const generateDateRange = (start, end, filterDays = null) => {
  const dates = [];
  const startDate = new Date(start);
  const endDate = new Date(end);

  const current = new Date(startDate);
  while (current <= endDate) {
    // If filterDays is provided (custom mode), only include matching days
    if (!filterDays || filterDays.includes(current.getDay())) {
      dates.push(current.toISOString().split('T')[0]);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

// Single cart item scheduler
const CartItemScheduler = ({
  item,
  isExpanded,
  onToggleExpand,
  onUpdateSchedule,
  onUpdateAddOns,
  availableAddOns,
  subscriptionPlans = [],
  defaultMode = 'single'
}) => {
  const { selectedPlan, setSelectedPlan } = useCart();
  const [scheduleMode, setScheduleMode] = useState(defaultMode); // 'single', 'multiple', 'custom'
  const [selectedDates, setSelectedDates] = useState(
    item.schedule?.dates?.map(d => d.date) || []
  );
  const [selectedTime, setSelectedTime] = useState(
    item.schedule?.dates?.[0]?.time || null
  );
  const [selectedDuration, setSelectedDuration] = useState(
    item.schedule?.dates?.[0]?.duration || 60
  );
  const [selectedAddOns, setSelectedAddOns] = useState(item.addOns || []);

  // Date range for multiple/custom modes
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // Custom mode: selected days of week (0-6)
  const [selectedDays, setSelectedDays] = useState([]);

  // Auto-calculate end date when subscription plan is selected
  useEffect(() => {
    if (selectedPlan && startDate) {
      // Calculate end date based on plan duration
      const start = new Date(startDate);
      const calculatedEnd = addMonths(start, selectedPlan.durationMonths);
      // Subtract 1 day to make it inclusive (e.g., Jan 1 + 1 month = Jan 31, not Feb 1)
      calculatedEnd.setDate(calculatedEnd.getDate() - 1);
      const endDateStr = calculatedEnd.toISOString().split('T')[0];
      setEndDate(endDateStr);
    } else if (!selectedPlan && endDate) {
      // Plan deselected - clear end date so user can select manually
      setEndDate(null);
      setSelectedDates([]);
    }
  }, [selectedPlan, startDate]);

  // Generate dates when range or days change
  useEffect(() => {
    if (scheduleMode === 'single' && !selectedPlan) return;

    if (startDate && endDate) {
      if (scheduleMode === 'multiple' || selectedPlan) {
        // Multiple or subscription plan: all dates in range (or filtered by days if custom mode with plan)
        if (scheduleMode === 'custom' && selectedDays.length > 0) {
          const dates = generateDateRange(startDate, endDate, selectedDays);
          setSelectedDates(dates);
        } else if (scheduleMode === 'custom' && selectedDays.length === 0) {
          // Custom mode but no days selected - generate all dates
          const dates = generateDateRange(startDate, endDate);
          setSelectedDates(dates);
        } else {
          const dates = generateDateRange(startDate, endDate);
          setSelectedDates(dates);
        }
      } else if (scheduleMode === 'custom' && selectedDays.length > 0) {
        // Custom: only selected days in range
        const dates = generateDateRange(startDate, endDate, selectedDays);
        setSelectedDates(dates);
      } else if (scheduleMode === 'custom' && selectedDays.length === 0) {
        // Custom but no days selected yet
        setSelectedDates([]);
      }
    }
  }, [scheduleMode, startDate, endDate, selectedDays, selectedPlan]);

  // Update parent when schedule changes
  useEffect(() => {
    if (selectedDates.length > 0 && selectedTime) {
      const scheduleData = {
        dates: selectedDates.map(date => ({
          date,
          time: selectedTime,
          duration: selectedDuration
        })),
        isCustom: scheduleMode === 'custom',
        customSettings: scheduleMode === 'custom' ? { selectedDays, startDate, endDate } : null
      };
      onUpdateSchedule(item.id, scheduleData);
    }
  }, [selectedDates, selectedTime, selectedDuration, scheduleMode, selectedDays, startDate, endDate, item.id, onUpdateSchedule]);

  // Update parent when add-ons change
  useEffect(() => {
    onUpdateAddOns(item.id, selectedAddOns);
  }, [selectedAddOns, item.id, onUpdateAddOns]);

  // Clear dates when switching modes
  const handleModeChange = (newMode) => {
    setScheduleMode(newMode);
    setSelectedDates([]);
    setSelectedDays([]);
    setStartDate(null);
    setEndDate(null);
  };

  const handleDatesReplace = (dates) => {
    setSelectedDates(dates);
  };

  const handleDaysChange = (days) => {
    setSelectedDays(days);
  };

  const handleToggleAddOn = (addon) => {
    setSelectedAddOns(prev => {
      const exists = prev.some(a => a.id === addon.id);
      if (exists) {
        return prev.filter(a => a.id !== addon.id);
      }
      return [...prev, { ...addon, perVisit: true }];
    });
  };

  const isScheduled = selectedDates.length > 0 && selectedTime;

  // Calculate price preview
  const visits = selectedDates.length || 1;
  const durationMultiplier = selectedDuration / 60;
  const baseTotal = (item.basePrice || item.price) * durationMultiplier * visits;
  const addOnsTotal = selectedAddOns.reduce((sum, addon) => sum + addon.price * visits, 0);
  const itemTotal = baseTotal + addOnsTotal;

  return (
    <div className={`bg-white rounded-2xl border-2 transition-all ${isScheduled ? 'border-emerald-200' : 'border-stone-200'
      }`}>
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isScheduled ? 'bg-emerald-100' : 'bg-stone-100'
            }`}>
            {isScheduled ? (
              <Check className="w-5 h-5 text-emerald-600" />
            ) : (
              <Calendar className="w-5 h-5 text-stone-500" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-green-900">{item.serviceName || item.name}</h3>
            <p className="text-sm text-stone-500">
              {isScheduled ? (
                <>
                  {selectedDates.length} visit{selectedDates.length > 1 ? 's' : ''} scheduled
                  {scheduleMode === 'custom' && <span className="text-emerald-600"> (Custom)</span>}
                  <span className="mx-1">•</span>
                  ${itemTotal.toFixed(0)} total
                </>
              ) : (
                'Tap to schedule'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-emerald-600">
            ${item.basePrice || item.price}/visit
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-stone-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-stone-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-stone-100">
          {/* Schedule Mode Toggle */}
          <div className="my-4">
            <label className="text-sm font-semibold text-green-900 mb-3 block">
              Booking Type
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-stone-100 rounded-xl">
              {SCHEDULE_MODES.map(mode => {
                const Icon = mode.icon;
                const isActive = scheduleMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => handleModeChange(mode.id)}
                    className={`flex flex-col items-center gap-1 py-3 px-2 rounded-lg transition-all ${isActive
                      ? 'bg-white shadow-sm text-green-900'
                      : 'text-stone-500 hover:text-stone-700'
                      }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-500' : ''}`} />
                    <span className="text-xs font-medium">{mode.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-stone-500 mt-2 text-center">
              {SCHEDULE_MODES.find(m => m.id === scheduleMode)?.description}
            </p>
          </div>

          {/* Subscription Plan Selection */}
          {(scheduleMode === 'multiple' || scheduleMode === 'custom') && subscriptionPlans.length > 0 && (
            <div className="mb-6">
              <label className="text-sm font-semibold text-green-900 mb-3 block">
                Choose Subscription Plan (Optional)
              </label>
              <div className="grid grid-cols-2 gap-3">
                {subscriptionPlans.map(plan => {
                  // Add durationMonths based on min_commitment_months
                  const planWithDuration = {
                    ...plan,
                    durationMonths: plan.min_commitment_months || 1
                  };
                  const isSelected = selectedPlan?.id === plan.id;

                  return (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(isSelected ? null : planWithDuration)}
                      className={`relative p-3 rounded-xl border-2 transition-all text-left ${isSelected
                        ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                        : 'border-stone-200 hover:border-emerald-200 hover:bg-stone-50'
                        }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`font-bold ${isSelected ? 'text-green-900' : 'text-stone-700'}`}>
                          {plan.name}
                        </span>
                        {plan.discount_percentage && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isSelected ? 'bg-emerald-500 text-white' : 'bg-lime-100 text-lime-700'
                            }`}>
                            {parseFloat(plan.discount_percentage).toFixed(0)}% OFF
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500">{plan.visits_per_month} visits/month</p>

                      {isSelected && (
                        <div className="absolute -top-2 -right-2 bg-green-900 text-white p-1 rounded-full shadow-sm">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Date Selection */}
          <div className="mb-6">
            <label className="text-base font-semibold text-green-900 mb-3 block">
              {selectedPlan
                ? `Select Start Date (${selectedPlan.name} subscription)`
                : scheduleMode === 'single'
                  ? 'Select Date'
                  : scheduleMode === 'custom'
                    ? 'Choose Your Schedule'
                    : 'Select Date Range'}
            </label>

            {/* Subscription period display when plan is selected */}
            {selectedPlan && startDate && endDate && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CalendarRange className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Subscription Period: {format(new Date(startDate), 'MMM d, yyyy')} — {format(new Date(endDate), 'MMM d, yyyy')}
                  </span>
                </div>
                <p className="text-xs text-emerald-600 mt-1">
                  {selectedDates.length} cleaning visits will be scheduled
                </p>
              </div>
            )}

            <DatePicker
              selectedDates={selectedDates}
              onDatesReplace={handleDatesReplace}
              mode={selectedPlan ? 'subscription' : scheduleMode}
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={selectedPlan ? () => {} : setEndDate}
              selectedDays={selectedDays}
              onDaysChange={handleDaysChange}
            />
          </div>

          {/* Time Selection */}
          {selectedDates.length > 0 && (
            <div className="mb-6">
              <BookingTimeSelector
                selectedTime={selectedTime}
                onSelect={setSelectedTime}
                selectedDate={selectedDates[0]}
              />
              {selectedDates.length > 1 && (
                <p className="text-xs text-stone-500 mt-2 text-center">
                  Same time will be applied to all {selectedDates.length} visits
                </p>
              )}
            </div>
          )}

          {/* Duration Selection */}
          {selectedDates.length > 0 && selectedTime && (
            <BookingDurationSelector
              selectedDuration={selectedDuration}
              onSelect={setSelectedDuration}
              basePrice={item.basePrice || item.price}
            />
          )}

          {/* Add-ons Selection */}
          {selectedDates.length > 0 && selectedTime && (
            <AddOnSelector
              selectedAddOns={selectedAddOns}
              onToggleAddOn={handleToggleAddOn}
              availableAddOns={availableAddOns}
            />
          )}

          {/* Price Summary */}
          {isScheduled && (
            <div className="mt-6 p-4 bg-stone-50 rounded-xl">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-600">
                    Base ({visits} × ${item.basePrice || item.price} × {selectedDuration}min)
                  </span>
                  <span className="font-medium">${baseTotal.toFixed(0)}</span>
                </div>
                {selectedAddOns.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-stone-600">
                      Add-ons ({visits} visit{visits > 1 ? 's' : ''})
                    </span>
                    <span className="font-medium">+${addOnsTotal.toFixed(0)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-stone-200 flex justify-between">
                  <span className="font-semibold text-green-900">Item Total</span>
                  <span className="font-bold text-emerald-600">${itemTotal.toFixed(0)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Main CartScheduler component
const CartScheduler = ({ onContinue, onBack, defaultMode = 'single' }) => {
  const {
    items,
    updateItemSchedule,
    updateItemAddOns,
    allItemsScheduled,
    priceBreakdown
  } = useCart();

  const [expandedItem, setExpandedItem] = useState(items[0]?.id || null);
  const [availableAddOns, setAvailableAddOns] = useState([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);

  // Fetch subscription plans from API
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await axios.get(`${API}/subscriptions/plans`);
        setSubscriptionPlans(response.data);
      } catch (error) {
        console.error('Failed to fetch subscription plans:', error);
        // Plans will be empty, subscription option won't show
      }
    };
    fetchPlans();
  }, []);

  // Fetch available add-ons
  useEffect(() => {
    const fetchAddOns = async () => {
      try {
        const response = await axios.get(`${API}/addons`);
        setAvailableAddOns(response.data);
      } catch (error) {
        // Use mock add-ons if API fails
        setAvailableAddOns([
          { id: 1, name: 'Oven Cleaning', price: 50, duration: '30 min' },
          { id: 2, name: 'Fridge Cleaning', price: 40, duration: '30 min' },
          { id: 3, name: 'Window Cleaning', price: 75, duration: '45 min' },
          { id: 4, name: 'Laundry & Ironing', price: 60, duration: '1 hr' },
          { id: 5, name: 'Carpet Shampooing', price: 100, duration: '1 hr' },
          { id: 6, name: 'Balcony Cleaning', price: 45, duration: '30 min' },
        ]);
      }
    };
    fetchAddOns();
  }, []);

  // Auto-expand first unscheduled item
  useEffect(() => {
    const firstUnscheduled = items.find(item =>
      !item.schedule?.dates || item.schedule.dates.length === 0
    );
    if (firstUnscheduled) {
      setExpandedItem(firstUnscheduled.id);
    }
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-stone-400" />
        </div>
        <h3 className="text-lg font-semibold text-green-900 mb-2">Your cart is empty</h3>
        <p className="text-stone-500 mb-4">Add services to get started</p>
        <Button
          onClick={() => window.location.href = '/services'}
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full"
        >
          Browse Services
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-green-900 mb-2">Schedule Your Services</h2>
        <p className="text-stone-600">
          Choose dates and times for each service in your cart
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className={`px-3 py-1 rounded-full font-medium ${allItemsScheduled
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-amber-100 text-amber-700'
          }`}>
          {items.filter(i => i.schedule?.dates?.length > 0).length} of {items.length} scheduled
        </span>
      </div>

      {/* Cart Items */}
      <div className="space-y-4">
        {items.map(item => (
          <CartItemScheduler
            key={item.id}
            item={item}
            isExpanded={expandedItem === item.id}
            onToggleExpand={() => setExpandedItem(
              expandedItem === item.id ? null : item.id
            )}
            onUpdateSchedule={updateItemSchedule}
            onUpdateAddOns={updateItemAddOns}
            availableAddOns={availableAddOns}
            subscriptionPlans={subscriptionPlans}
            defaultMode={defaultMode}
          />
        ))}
      </div>

      {/* Price Summary */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-emerald-100">
        <h3 className="font-semibold text-green-900 mb-4">Price Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-600">Subtotal ({priceBreakdown.totalVisits} visits)</span>
            <span className="font-medium">${priceBreakdown.subtotal.toFixed(2)}</span>
          </div>
          {priceBreakdown.discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Multi-visit discount ({(priceBreakdown.discountRate * 100).toFixed(0)}%)</span>
              <span>-${priceBreakdown.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-stone-600">Tax ({(priceBreakdown.taxRate * 100).toFixed(0)}%)</span>
            <span className="font-medium">${priceBreakdown.tax.toFixed(2)}</span>
          </div>
          <div className="pt-3 border-t border-emerald-200 flex justify-between">
            <span className="font-bold text-green-900 text-base">Total</span>
            <span className="font-bold text-emerald-600 text-lg">${priceBreakdown.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Not all scheduled warning */}
      {!allItemsScheduled && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Schedule all services to continue
            </p>
            <p className="text-xs text-amber-700">
              Please select dates and times for all items in your cart
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {onBack && (
          <Button
            onClick={onBack}
            variant="outline"
            className="flex-1 rounded-full h-12 border-2"
          >
            Back
          </Button>
        )}
        <Button
          onClick={onContinue}
          disabled={!allItemsScheduled}
          className={`flex-1 rounded-full h-12 text-white ${allItemsScheduled
            ? 'bg-emerald-500 hover:bg-emerald-600'
            : 'bg-stone-300 cursor-not-allowed'
            }`}
        >
          Continue to Review
        </Button>
      </div>
    </div>
  );
};

export default CartScheduler;
