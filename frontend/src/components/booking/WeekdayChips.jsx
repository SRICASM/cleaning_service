import React from 'react';
import { Check } from 'lucide-react';

const WEEKDAYS = [
  { id: 0, label: 'Sun', fullLabel: 'Sunday' },
  { id: 1, label: 'Mon', fullLabel: 'Monday' },
  { id: 2, label: 'Tue', fullLabel: 'Tuesday' },
  { id: 3, label: 'Wed', fullLabel: 'Wednesday' },
  { id: 4, label: 'Thu', fullLabel: 'Thursday' },
  { id: 5, label: 'Fri', fullLabel: 'Friday' },
  { id: 6, label: 'Sat', fullLabel: 'Saturday' }
];

// Preset options
const PRESETS = [
  { id: 'weekdays', label: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { id: 'weekends', label: 'Weekends', days: [0, 6] },
  { id: 'all', label: 'All Days', days: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'mwf', label: 'Mon/Wed/Fri', days: [1, 3, 5] },
  { id: 'tth', label: 'Tue/Thu', days: [2, 4] }
];

const WeekdayChips = ({
  selectedDays = [],
  onDaysChange,
  showPresets = true,
  compact = false
}) => {
  const toggleDay = (dayId) => {
    const newDays = selectedDays.includes(dayId)
      ? selectedDays.filter(d => d !== dayId)
      : [...selectedDays, dayId].sort((a, b) => a - b);
    onDaysChange(newDays);
  };

  const applyPreset = (preset) => {
    onDaysChange(preset.days);
  };

  const isPresetActive = (preset) => {
    if (selectedDays.length !== preset.days.length) return false;
    return preset.days.every(d => selectedDays.includes(d));
  };

  return (
    <div className="w-full space-y-4">
      {/* Presets */}
      {showPresets && (
        <div>
          <label className="text-xs font-medium text-stone-500 mb-2 block">
            Quick Select
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => {
              const isActive = isPresetActive(preset);
              return (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Day chips */}
      <div>
        <label className="text-sm font-semibold text-green-900 mb-3 block">
          Select Days
        </label>

        <div className={`grid ${compact ? 'grid-cols-7 gap-1' : 'grid-cols-7 gap-2'}`}>
          {WEEKDAYS.map((day) => {
            const isSelected = selectedDays.includes(day.id);

            return (
              <button
                key={day.id}
                onClick={() => toggleDay(day.id)}
                className={`relative flex flex-col items-center justify-center transition-all ${
                  compact ? 'p-2' : 'p-3'
                } rounded-xl ${
                  isSelected
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <span className={`font-bold ${compact ? 'text-sm' : 'text-base'}`}>
                  {day.label}
                </span>
                {!compact && (
                  <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-stone-400'}`}>
                    {day.fullLabel.slice(0, 3)}
                  </span>
                )}

                {isSelected && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                    <Check className="w-3 h-3 text-emerald-500" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected summary */}
        {selectedDays.length > 0 && (
          <p className="text-xs text-stone-500 mt-3 text-center">
            {selectedDays.length === 7
              ? 'Every day'
              : selectedDays.length === 0
              ? 'Select at least one day'
              : `${selectedDays.length} day${selectedDays.length > 1 ? 's' : ''} selected: ${
                  selectedDays.map(d => WEEKDAYS.find(w => w.id === d)?.label).join(', ')
                }`
            }
          </p>
        )}
      </div>
    </div>
  );
};

export default WeekdayChips;
export { WEEKDAYS, PRESETS };
