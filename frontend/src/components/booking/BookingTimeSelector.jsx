import React, { useState, useMemo } from 'react';
import { Sun, Sunset, Moon } from 'lucide-react';

const sections = [
    { id: 'morning', label: 'Morning', icon: Sun, start: 7, end: 11.5 },   // 7:00 AM - 11:30 AM
    { id: 'afternoon', label: 'Afternoon', icon: Sunset, start: 12, end: 16.5 }, // 12:00 PM - 4:30 PM
    { id: 'evening', label: 'Evening', icon: Moon, start: 17, end: 20 },     // 5:00 PM - 8:00 PM
];

const BookingTimeSelector = ({ selectedTime, onSelect, selectedDate }) => {
    const [activeSection, setActiveSection] = useState('morning');

    // Generate slots specifically for the active section
    const slots = useMemo(() => {
        const section = sections.find(s => s.id === activeSection);
        if (!section) return [];

        const generated = [];
        let current = section.start;

        while (current <= section.end) {
            const hour = Math.floor(current);
            const minute = (current % 1) * 60;
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour > 12 ? hour - 12 : (hour === 0 || hour === 12 ? 12 : hour);
            const displayMinute = minute === 0 ? '00' : '30';

            const timeString = `${displayHour.toString().padStart(2, '0')}:${displayMinute} ${period}`;
            generated.push(timeString);

            current += 0.5; // Add 30 mins
        }
        return generated;
    }, [activeSection]);

    const isTimeDisabled = (time) => {
        if (!selectedDate) return true;

        const today = new Date();
        const checkDate = new Date(selectedDate);

        // Check if selected date is today
        const isToday = checkDate.getDate() === today.getDate() &&
            checkDate.getMonth() === today.getMonth() &&
            checkDate.getFullYear() === today.getFullYear();

        if (!isToday) return false;

        // Logic to disable past times if today
        const [timeStr, modifier] = time.split(' ');
        let [hours, minutes] = timeStr.split(':');
        hours = parseInt(hours, 10);
        minutes = parseInt(minutes, 10);
        if (hours === 12 && modifier === 'AM') hours = 0;
        if (hours !== 12 && modifier === 'PM') hours += 12;

        const slotTime = new Date();
        slotTime.setHours(hours, minutes, 0, 0);

        const now = new Date();
        // 1 hour buffer
        return slotTime < new Date(now.getTime() + 60 * 60 * 1000);
    };

    return (
        <div className="animate-fadeIn">
            <label className="text-base font-semibold text-green-900 mb-4 block text-center">Start Time</label>

            {/* Tabs */}
            <div className="flex p-1 bg-stone-100 rounded-xl mb-6">
                {sections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    return (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${isActive
                                ? 'bg-white text-green-900 shadow-sm'
                                : 'text-stone-500 hover:text-stone-700'
                                }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-lime-600' : ''}`} />
                            {section.label}
                        </button>
                    );
                })}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {slots.map((time) => {
                    const disabled = isTimeDisabled(time);
                    const isSelected = selectedTime === time;

                    return (
                        <button
                            key={time}
                            onClick={() => !disabled && onSelect(time)}
                            disabled={disabled}
                            className={`py-3 px-2 rounded-xl text-sm font-semibold border transition-all ${disabled
                                ? 'border-transparent bg-stone-50 text-stone-300 cursor-not-allowed'
                                : isSelected
                                    ? 'border-green-600 bg-green-900 text-white shadow-md transform scale-[1.02]'
                                    : 'border-stone-200 bg-white text-stone-700 hover:border-green-400 hover:bg-green-50'
                                }`}
                        >
                            {time}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default BookingTimeSelector;
