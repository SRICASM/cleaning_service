import React from 'react';
import { Calendar, CalendarRange, CalendarClock } from 'lucide-react';

const SCHEDULE_MODES = [
  {
    id: 'single',
    label: 'Single',
    icon: Calendar,
    description: 'One-time cleaning'
  },
  {
    id: 'multiple',
    label: 'Multiple',
    icon: CalendarRange,
    description: 'Select date range'
  },
  {
    id: 'custom',
    label: 'Custom',
    icon: CalendarClock,
    description: 'Pick specific days'
  }
];

const ScheduleTabs = ({
  activeMode,
  onModeChange,
  modes = SCHEDULE_MODES,
  compact = false
}) => {
  return (
    <div className="w-full">
      {!compact && (
        <label className="text-sm font-semibold text-green-900 mb-3 block">
          Booking Type
        </label>
      )}

      <div className="flex p-1 bg-stone-100 rounded-xl">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;

          return (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg transition-all ${
                isActive
                  ? 'bg-white text-green-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : ''}`} />
                <span className="text-sm font-medium">{mode.label}</span>
              </div>
              {!compact && (
                <span className="text-[10px] text-stone-400 hidden sm:block">
                  {mode.description}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mode description on mobile */}
      {!compact && (
        <p className="text-xs text-stone-500 mt-2 text-center sm:hidden">
          {modes.find(m => m.id === activeMode)?.description}
        </p>
      )}
    </div>
  );
};

export default ScheduleTabs;
export { SCHEDULE_MODES };
