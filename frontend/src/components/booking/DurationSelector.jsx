import React from 'react';
import { Clock, Sparkles, Check } from 'lucide-react';

// Duration options for instant booking (AED pricing)
const DURATIONS = [
  {
    value: 60,
    label: '60 min',
    description: 'Quick clean',
    price: 75,
    originalPrice: 95,
    recommended: false
  },
  {
    value: 90,
    label: '90 min',
    description: 'Standard clean',
    price: 105,
    originalPrice: 135,
    recommended: true,
    badge: 'Most Popular'
  },
  {
    value: 120,
    label: '2 hours',
    description: 'Deep clean',
    price: 135,
    originalPrice: 175,
    recommended: false,
    badge: 'Best Value'
  }
];

const DurationSelector = ({
  selectedDuration,
  onSelect,
  durations = DURATIONS,
  currency = 'AED',
  compact = false
}) => {
  return (
    <div className="w-full">
      {!compact && (
        <div className="flex items-center justify-between mb-4">
          <label className="text-base font-semibold text-green-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            Select Duration
          </label>
        </div>
      )}

      <div className={`grid gap-3 ${compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {durations.map((duration) => {
          const isSelected = selectedDuration === duration.value;
          const discount = Math.round(((duration.originalPrice - duration.price) / duration.originalPrice) * 100);

          return (
            <button
              key={duration.value}
              onClick={() => onSelect(duration.value)}
              className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-200 group ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50 shadow-lg ring-2 ring-emerald-500/20'
                  : 'border-stone-200 bg-white hover:border-emerald-200 hover:shadow-md'
              } ${duration.recommended ? 'ring-1 ring-emerald-200' : ''}`}
            >
              {/* Badge */}
              {duration.badge && (
                <div className={`absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isSelected
                    ? 'bg-emerald-500 text-white'
                    : 'bg-lime-100 text-lime-700 border border-lime-200'
                }`}>
                  {duration.badge}
                </div>
              )}

              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}

              {/* Content */}
              <div className="space-y-2">
                {/* Duration label */}
                <div className="flex items-baseline gap-2">
                  <span className={`font-bold text-xl ${isSelected ? 'text-green-900' : 'text-stone-800'}`}>
                    {duration.label}
                  </span>
                </div>

                {/* Description */}
                <p className={`text-sm ${isSelected ? 'text-emerald-700' : 'text-stone-500'}`}>
                  {duration.description}
                </p>

                {/* Price */}
                <div className="flex items-baseline gap-2 pt-2 border-t border-stone-100">
                  <span className={`font-bold text-lg ${isSelected ? 'text-emerald-600' : 'text-stone-900'}`}>
                    {currency} {duration.price}
                  </span>
                  <span className="text-sm text-stone-400 line-through">
                    {currency} {duration.originalPrice}
                  </span>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                    isSelected ? 'bg-emerald-500 text-white' : 'bg-lime-100 text-lime-700'
                  }`}>
                    -{discount}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Info text */}
      {!compact && (
        <p className="text-xs text-stone-500 mt-3 text-center">
          All prices include cleaning supplies and equipment
        </p>
      )}
    </div>
  );
};

export default DurationSelector;
