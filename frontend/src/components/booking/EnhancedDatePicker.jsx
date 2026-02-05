import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, CalendarRange } from 'lucide-react';
import { addDays, addWeeks, addMonths, format, startOfDay, isSameDay, isWithinInterval, isBefore, isAfter } from 'date-fns';

// Quick selection options
const QUICK_OPTIONS = {
  single: [
    { label: 'Today', getValue: () => new Date() },
    { label: 'Tomorrow', getValue: () => addDays(new Date(), 1) },
    { label: 'This Weekend', getValue: () => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
      return addDays(today, daysUntilSaturday);
    }},
    { label: 'Next Week', getValue: () => addWeeks(new Date(), 1) }
  ],
  range: [
    { label: 'Next 7 Days', getValue: () => ({ start: new Date(), end: addDays(new Date(), 6) }) },
    { label: 'Next 2 Weeks', getValue: () => ({ start: new Date(), end: addDays(new Date(), 13) }) },
    { label: 'This Month', getValue: () => {
      const today = new Date();
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: today, end: endOfMonth };
    }},
    { label: 'Next 30 Days', getValue: () => ({ start: new Date(), end: addDays(new Date(), 29) }) }
  ]
};

const EnhancedDatePicker = ({
  mode = 'single', // 'single', 'range', 'multiple'
  selectedDate = null,
  selectedRange = null, // { start: Date, end: Date }
  selectedDates = [], // For multiple mode
  onDateSelect,
  onRangeSelect,
  onDatesSelect,
  minDate = new Date(),
  maxDate = addMonths(new Date(), 6),
  showQuickOptions = true
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState(null);

  // Calendar generation
  const calendar = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const weeks = [];
    let currentWeek = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      currentWeek.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      currentWeek.push(date);

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Fill remaining cells
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    return weeks;
  }, [currentMonth]);

  const isDateDisabled = (date) => {
    if (!date) return true;
    const normalized = startOfDay(date);
    const minNorm = startOfDay(minDate);
    const maxNorm = startOfDay(maxDate);
    return isBefore(normalized, minNorm) || isAfter(normalized, maxNorm);
  };

  const isDateSelected = (date) => {
    if (!date) return false;

    if (mode === 'single') {
      return selectedDate && isSameDay(date, selectedDate);
    }

    if (mode === 'range') {
      if (selectedRange?.start && selectedRange?.end) {
        return isWithinInterval(date, { start: selectedRange.start, end: selectedRange.end });
      }
      if (selectedRange?.start) {
        return isSameDay(date, selectedRange.start);
      }
    }

    if (mode === 'multiple') {
      return selectedDates.some(d => isSameDay(d, date));
    }

    return false;
  };

  const isRangeStart = (date) => {
    return mode === 'range' && selectedRange?.start && isSameDay(date, selectedRange.start);
  };

  const isRangeEnd = (date) => {
    return mode === 'range' && selectedRange?.end && isSameDay(date, selectedRange.end);
  };

  const isInHoverRange = (date) => {
    if (mode !== 'range' || !selectedRange?.start || selectedRange?.end || !hoveredDate) return false;
    const start = selectedRange.start;
    const end = hoveredDate;
    if (isBefore(end, start)) {
      return isWithinInterval(date, { start: end, end: start });
    }
    return isWithinInterval(date, { start, end });
  };

  const handleDateClick = (date) => {
    if (isDateDisabled(date)) return;

    if (mode === 'single') {
      onDateSelect?.(date);
    }

    if (mode === 'range') {
      if (!selectedRange?.start || selectedRange?.end) {
        // Start new selection
        onRangeSelect?.({ start: date, end: null });
      } else {
        // Complete selection
        const start = selectedRange.start;
        if (isBefore(date, start)) {
          onRangeSelect?.({ start: date, end: start });
        } else {
          onRangeSelect?.({ start, end: date });
        }
      }
    }

    if (mode === 'multiple') {
      const exists = selectedDates.some(d => isSameDay(d, date));
      if (exists) {
        onDatesSelect?.(selectedDates.filter(d => !isSameDay(d, date)));
      } else {
        onDatesSelect?.([...selectedDates, date].sort((a, b) => a - b));
      }
    }
  };

  const handleQuickOption = (option) => {
    const value = option.getValue();

    if (mode === 'single') {
      onDateSelect?.(value);
    } else if (mode === 'range') {
      onRangeSelect?.(value);
    }
  };

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => addMonths(prev, direction));
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="w-full">
      {/* Quick Options */}
      {showQuickOptions && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {QUICK_OPTIONS[mode === 'multiple' ? 'single' : mode]?.map((option) => (
              <button
                key={option.label}
                onClick={() => handleQuickOption(option)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {/* Month Navigation */}
        <div className="flex items-center justify-between p-3 bg-stone-50 border-b border-stone-200">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-stone-600" />
          </button>
          <span className="font-semibold text-green-900">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 hover:bg-white rounded-lg transition-colors"
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

        {/* Calendar Grid */}
        <div className="p-2">
          {calendar.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 gap-1">
              {week.map((date, dayIdx) => {
                if (!date) {
                  return <div key={dayIdx} className="h-10" />;
                }

                const disabled = isDateDisabled(date);
                const selected = isDateSelected(date);
                const rangeStart = isRangeStart(date);
                const rangeEnd = isRangeEnd(date);
                const inHover = isInHoverRange(date);
                const isToday = isSameDay(date, new Date());

                let cellClass = 'h-10 rounded-lg text-sm font-medium transition-all flex items-center justify-center';

                if (disabled) {
                  cellClass += ' text-stone-300 cursor-not-allowed';
                } else if (rangeStart || rangeEnd) {
                  cellClass += ' bg-emerald-500 text-white shadow-md';
                } else if (selected) {
                  cellClass += mode === 'range'
                    ? ' bg-emerald-100 text-emerald-700'
                    : ' bg-emerald-500 text-white shadow-md';
                } else if (inHover) {
                  cellClass += ' bg-emerald-50 text-emerald-600';
                } else if (isToday) {
                  cellClass += ' ring-2 ring-emerald-300 text-emerald-700 hover:bg-emerald-50';
                } else {
                  cellClass += ' text-stone-700 hover:bg-stone-100';
                }

                return (
                  <button
                    key={dayIdx}
                    onClick={() => handleDateClick(date)}
                    onMouseEnter={() => setHoveredDate(date)}
                    onMouseLeave={() => setHoveredDate(null)}
                    disabled={disabled}
                    className={cellClass}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Selection Summary */}
      <div className="mt-3 text-center">
        {mode === 'single' && selectedDate && (
          <p className="text-sm text-emerald-600 font-medium flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4" />
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </p>
        )}

        {mode === 'range' && selectedRange?.start && (
          <p className="text-sm text-emerald-600 font-medium flex items-center justify-center gap-2">
            <CalendarRange className="w-4 h-4" />
            {selectedRange.end
              ? `${format(selectedRange.start, 'MMM d')} - ${format(selectedRange.end, 'MMM d, yyyy')}`
              : `${format(selectedRange.start, 'MMM d, yyyy')} → Select end date`
            }
          </p>
        )}

        {mode === 'multiple' && selectedDates.length > 0 && (
          <p className="text-sm text-emerald-600 font-medium">
            {selectedDates.length} date{selectedDates.length > 1 ? 's' : ''} selected
          </p>
        )}
      </div>
    </div>
  );
};

export default EnhancedDatePicker;
