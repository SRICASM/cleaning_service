import React from 'react';
import { Clock } from 'lucide-react';

const durations = [
    { label: '60 min', value: 60, multiplier: 1 },
    { label: '90 min', value: 90, multiplier: 1.5 },
    { label: '2 hrs', value: 120, multiplier: 2 },
    { label: '2.5 hrs', value: 150, multiplier: 2.5 },
    { label: '3 hrs', value: 180, multiplier: 3 },
    { label: '4 hrs', value: 240, multiplier: 4 },
];

const BookingDurationSelector = ({ selectedDuration, onSelect, basePrice }) => {
    return (
        <div className="mb-8 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
                <label className="text-base font-semibold text-green-900">Duration</label>
                {selectedDuration > 180 && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full font-medium">
                        Recommended for deep cleaning
                    </span>
                )}
            </div>

            <div className="grid grid-cols-3 gap-3">
                {durations.map((item) => {
                    const isSelected = selectedDuration === item.value;
                    const calculatedPrice = (basePrice * item.multiplier).toFixed(0);

                    return (
                        <button
                            key={item.value}
                            onClick={() => onSelect(item.value)}
                            className={`relative p-4 rounded-xl border-2 text-center transition-all duration-200 group flex flex-col items-center justify-center ${isSelected
                                ? 'border-emerald-500 bg-emerald-50/50 shadow-md ring-1 ring-emerald-500'
                                : 'border-stone-200 bg-white hover:border-emerald-200 hover:shadow-sm'
                                }`}
                        >
                            <div className="flex flex-col gap-1 items-center">
                                <span className={`font-bold text-lg ${isSelected ? 'text-green-900' : 'text-stone-700'}`}>
                                    {item.label}
                                </span>

                                <div className="flex items-baseline gap-1.5">
                                    <span className={`font-bold ${isSelected ? 'text-emerald-700' : 'text-stone-900'}`}>
                                        ${calculatedPrice}
                                    </span>
                                    {/* Fake "original price" for psychological effect - 20% higher */}
                                    <span className="text-xs text-stone-400 line-through">
                                        {(calculatedPrice * 1.25).toFixed(0)}
                                    </span>
                                </div>
                            </div>

                            {isSelected && (
                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default BookingDurationSelector;
