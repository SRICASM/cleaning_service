import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Repeat, CheckSquare } from 'lucide-react';
import { addDays, format, eachDayOfInterval, isSameDay } from 'date-fns';

const tabs = [
    { id: 'single', label: 'Single', icon: CalendarIcon },
    { id: 'multiple', label: 'Pick Dates', icon: CheckSquare },
    { id: 'custom', label: 'Range / Recurring', icon: Repeat },
];

const weekDays = [
    { label: 'M', value: 1 }, // Monday
    { label: 'T', value: 2 },
    { label: 'W', value: 3 },
    { label: 'T', value: 4 },
    { label: 'F', value: 5 },
    { label: 'S', value: 6 },
    { label: 'S', value: 0 }, // Sunday
];

const BookingScheduleTabs = ({ onDatesChange, initialDates = [] }) => {
    const [activeTab, setActiveTab] = useState('single');

    // Single Mode State
    const [singleDate, setSingleDate] = useState(initialDates[0] || null);

    // Custom (Range + Weekdays) Mode State
    const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
    const [selectedWeekDays, setSelectedWeekDays] = useState([1, 2, 3, 4, 5, 6, 0]); // All days by default

    // Multiple (Specific Dates) Mode State
    const [specificDates, setSpecificDates] = useState([]);

    // Effect to update parent whenever local state changes
    useEffect(() => {
        let finalDates = [];

        if (activeTab === 'single') {
            if (singleDate) finalDates = [singleDate];
        }
        else if (activeTab === 'custom') { // Custom is now Range + Weekdays
            if (dateRange?.from && dateRange?.to) {
                const interval = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
                finalDates = interval.filter(date => selectedWeekDays.includes(date.getDay()));
            } else if (dateRange?.from) {
                // Just one day selected so far in range
                if (selectedWeekDays.includes(dateRange.from.getDay())) {
                    finalDates = [dateRange.from];
                }
            }
        }
        else if (activeTab === 'multiple') { // Multiple is now Specific Dates
            finalDates = specificDates;
        }

        // Sort dates
        finalDates.sort((a, b) => a - b);
        onDatesChange(finalDates);
    }, [activeTab, singleDate, dateRange, selectedWeekDays, specificDates, onDatesChange]);


    const toggleWeekDay = (dayValue) => {
        setSelectedWeekDays(prev =>
            prev.includes(dayValue)
                ? prev.filter(d => d !== dayValue)
                : [...prev, dayValue]
        );
    };

    const handleSpecificDateSelect = (dates) => {
        setSpecificDates(dates || []);
    };

    return (
        <div className="animate-fadeIn">
            {/* Tabs */}
            <div className="flex p-1 bg-stone-100 rounded-xl mb-6">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 py-3 text-sm font-medium rounded-lg transition-all ${isActive
                                ? 'bg-white text-green-900 shadow-sm'
                                : 'text-stone-500 hover:text-stone-700'
                                }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-lime-600' : 'text-stone-400'}`} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-4">

                {/* SINGLE MODE */}
                {activeTab === 'single' && (
                    <div className="space-y-4">
                        <div className="flex gap-3 mb-2">
                            <button
                                onClick={() => setSingleDate(new Date())}
                                className="flex-1 py-2 rounded-lg border border-stone-200 text-sm font-medium hover:border-green-500 hover:text-green-700 transition-colors"
                            >
                                Today
                            </button>
                            <button
                                onClick={() => setSingleDate(addDays(new Date(), 1))}
                                className="flex-1 py-2 rounded-lg border border-stone-200 text-sm font-medium hover:border-green-500 hover:text-green-700 transition-colors"
                            >
                                Tomorrow
                            </button>
                        </div>

                        <Calendar
                            mode="single"
                            selected={singleDate}
                            onSelect={setSingleDate}
                            disabled={(date) => date < new Date().setHours(0, 0, 0, 0)}
                            className="rounded-md border-0 w-full flex justify-center"
                        />
                    </div>
                )}

                {/* MULTIPLE (SPECIFIC DATES) MODE */}
                {activeTab === 'multiple' && (
                    <div>
                        <p className="text-sm text-stone-500 mb-4 text-center">
                            Tap specific dates to separate them.
                        </p>
                        <Calendar
                            mode="multiple"
                            selected={specificDates}
                            onSelect={handleSpecificDateSelect}
                            disabled={(date) => date < new Date().setHours(0, 0, 0, 0)}
                            className="rounded-md border-0 w-full flex justify-center"
                        />
                    </div>
                )}

                {/* CUSTOM (RANGE + WEEKDAYS) MODE */}
                {activeTab === 'custom' && (
                    <div className="space-y-6">
                        <div>
                            <label className="text-sm font-medium text-stone-700 mb-2 block text-center">1. Select Days of Week</label>
                            <div className="flex justify-between gap-1">
                                {weekDays.map((day) => (
                                    <button
                                        key={day.value}
                                        onClick={() => toggleWeekDay(day.value)}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${selectedWeekDays.includes(day.value)
                                            ? 'bg-green-900 text-white shadow-md'
                                            : 'bg-stone-50 text-stone-400 border border-stone-100'
                                            }`}
                                    >
                                        {day.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-stone-700 mb-2 block text-center">2. Select Date Range</label>
                            <Calendar
                                mode="range"
                                selected={dateRange}
                                onSelect={setDateRange}
                                disabled={(date) => date < new Date().setHours(0, 0, 0, 0)}
                                className="rounded-md border-0 w-full flex justify-center"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BookingScheduleTabs;
