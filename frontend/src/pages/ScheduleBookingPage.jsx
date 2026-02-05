import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ScheduleTabs from '../components/booking/ScheduleTabs';
import TimePeriodSelector from '../components/booking/TimePeriodSelector';
import WeekdayChips from '../components/booking/WeekdayChips';
import EnhancedDatePicker from '../components/booking/EnhancedDatePicker';

import AddOnSelector from '../components/booking/AddOnSelector';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import {
  CalendarClock,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  ChevronLeft,
  Banknote,
  CalendarDays,
  Repeat,
  Shield,
  Home,
  Sparkles,
  Package,
  Zap,
  CalendarRange,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

import { format, eachDayOfInterval } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ServiceSelector = ({ services, selectedServiceId, onSelect }) => {
  // Service configuration for icons/colors
  const serviceConfig = {
    'Standard Cleaning': { icon: Home, color: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    'Deep Cleaning': { icon: Sparkles, color: 'bg-teal-50', iconColor: 'text-teal-600' },
    'Move In/Out Cleaning': { icon: Package, color: 'bg-blue-50', iconColor: 'text-blue-600' },
    // Fallback for others
    'default': { icon: Home, color: 'bg-gray-50', iconColor: 'text-gray-600' }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {services.map((service) => {
        // Find config by checking name inclusion
        const configKey = Object.keys(serviceConfig).find(key => service.name.includes(key)) || 'default';
        const config = serviceConfig[configKey];
        const Icon = config.icon;
        const isSelected = selectedServiceId === service.id;

        return (
          <button
            key={service.id}
            onClick={() => onSelect(service.id)}
            className={`
              relative flex items-center gap-3 p-3 rounded-xl border transition-all text-left
              ${isSelected
                ? 'bg-emerald-50/50 border-emerald-500 ring-1 ring-emerald-500 shadow-sm'
                : 'bg-white border-stone-200 hover:border-emerald-200 hover:bg-stone-50'
              }
            `}
          >
            <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${isSelected ? 'text-emerald-900' : 'text-gray-700'}`}>
                {service.name}
              </p>
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

// Hardcoded features for the popup
const SERVICE_FEATURES = {
  'Standard Cleaning': [
    'Dusting & wiping all accessible surfaces',
    'Vacuuming & mopping floors',
    'Cleaning mirrors & glass fixtures',
    'Kitchen: Sink, countertops, stove top',
    'Bathroom: Toilet, shower, cleaning tub, sink',
    'Emptying trash bins',
    'Making beds'
  ],
  'Deep Cleaning': [
    'Everything in Standard Cleaning',
    'Deep scrubbing of tile grout',
    'Cleaning inside cabinets & drawers (if empty)',
    'Cleaning behind appliances (if movable)',
    'Washing baseboards & door frames',
    'Dusting ceiling fans & vents',
    'Thorough disinfection of bathrooms'
  ],
  'Move In/Out Cleaning': [
    'Complete home transformation',
    'Deep cleaning of all surfaces',
    'Inside all cupboards, drawers, & wardrobes',
    'Inside Oven & Fridge',
    'Scrubbing floors & balcony',
    'Window sills & tracks',
    'Removing cobwebs & heavy dust'
  ]
};

const ServiceFeaturesModal = ({ isOpen, onClose, service }) => {
  if (!isOpen || !service) return null;

  // Find features based on name
  const featureKey = Object.keys(SERVICE_FEATURES).find(key => service.name.includes(key));
  const features = featureKey ? SERVICE_FEATURES[featureKey] : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
        <div className="relative h-24 bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white rounded-full p-1.5 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 rotate-180" />
          </button>
          <div className="text-white text-center">
            <h3 className="text-xl font-bold">{service.name}</h3>
            <p className="text-emerald-50 text-sm">Included Services</p>
          </div>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {features.length > 0 ? (
            <ul className="space-y-3">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <span className="text-stone-700 font-medium text-sm leading-tight">{feature}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-stone-500 text-center italic">Professional cleaning service included.</p>
          )}

          <div className="mt-8">
            <Button onClick={onClose} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-xl">
              Understand & Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// House Types Configuration
const HOUSE_TYPES = [
  { id: 'studio', label: 'Studio', duration: 120, price: 150, icon: Home },
  { id: '1bhk', label: '1 BHK', duration: 180, price: 225, icon: Home },
  { id: '2bhk', label: '2 BHK', duration: 240, price: 300, icon: Home },
  { id: '3bhk', label: '3 BHK', duration: 300, price: 375, icon: Home },
  { id: '4bhk', label: '4 BHK', duration: 360, price: 450, icon: Home },
  { id: '5bhk', label: '5 BHK', duration: 420, price: 525, icon: Home },
  { id: 'villa', label: 'Villa', duration: 480, price: 600, icon: Home },
];

const HOURLY_OPTIONS = [
  { value: 120, label: '2 Hours', price: 150 },
  { value: 180, label: '3 Hours', price: 225 },
  { value: 240, label: '4 Hours', price: 300 },
  { value: 300, label: '5 Hours', price: 375 },
  { value: 360, label: '6 Hours', price: 450 },
  { value: 420, label: '7 Hours', price: 525 },
  { value: 480, label: '8 Hours', price: 600 },
];

// Modes configuration
const MAIN_BOOKING_MODES = [
  { id: 'instant', label: 'Instant', icon: Zap, description: 'Cleaner arrives within 2 hours' },
  { id: 'schedule', label: 'Schedule', icon: Calendar, description: 'Pick a future date & time' }
];

const BookingDurationSection = ({ bookingMethod, setBookingMethod, selectedDuration, onDurationSelect }) => {
  const scrollRef = React.useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-emerald-600" />
          <label className="text-base font-semibold text-green-900">
            Hire by Hour or House Type
          </label>
        </div>

        {/* Toggle Tabs - Styled like ScheduleTabs */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setBookingMethod('size')}
            className={`
              relative flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all
              ${bookingMethod === 'size'
                ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 ring-4 ring-emerald-500/10'
                : 'border-stone-200 bg-white text-stone-600 hover:border-emerald-200 hover:bg-stone-50'
              }
            `}
          >
            <div className={`p-3 rounded-xl transition-colors ${bookingMethod === 'size' ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-100 text-stone-500'}`}>
              <Home className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm">By House Size</span>
            {bookingMethod === 'size' && (
              <div className="absolute top-3 right-3">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
            )}
          </button>

          <button
            onClick={() => setBookingMethod('hourly')}
            className={`
              relative flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all
              ${bookingMethod === 'hourly'
                ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 ring-4 ring-emerald-500/10'
                : 'border-stone-200 bg-white text-stone-600 hover:border-emerald-200 hover:bg-stone-50'
              }
            `}
          >
            <div className={`p-3 rounded-xl transition-colors ${bookingMethod === 'hourly' ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-100 text-stone-500'}`}>
              <Clock className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm">By Hourly Rate</span>
            {bookingMethod === 'hourly' && (
              <div className="absolute top-3 right-3">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
            )}
          </button>
        </div>
      </div>

      <div className="relative group">
        {/* Left Scroll Button */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm border border-stone-200 rounded-full p-2 shadow-lg text-stone-600 hover:text-emerald-600 hover:border-emerald-200 transition-all opacity-0 group-hover:opacity-100 -ml-3"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Scroll Containter */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto pb-4 -mx-2 px-2 gap-3 snap-x scrollbar-hide scroll-smooth"
        >
          {bookingMethod === 'size' ? (
            HOUSE_TYPES.map((type) => {
              const isSelected = selectedDuration === type.duration;
              return (
                <button
                  key={type.id}
                  onClick={() => onDurationSelect(type.duration)}
                  className={`
                    flex-shrink-0 w-32 snap-start p-4 rounded-xl border-2 text-left transition-all
                    ${isSelected
                      ? 'border-emerald-500 bg-emerald-50 shadow-md'
                      : 'border-stone-100 bg-white hover:border-emerald-100'
                    }
                  `}
                >
                  <div className={`w-8 h-8 rounded-lg mb-3 flex items-center justify-center ${isSelected ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-50 text-stone-400'
                    }`}>
                    <type.icon className="w-4 h-4" />
                  </div>
                  <p className={`font-bold text-sm mb-1 ${isSelected ? 'text-emerald-900' : 'text-stone-700'}`}>
                    {type.label}
                  </p>
                  <p className="text-xs text-stone-500 mb-2">{type.duration / 60} Hours</p>
                  <p className={`text-sm font-bold ${isSelected ? 'text-emerald-600' : 'text-stone-900'}`}>
                    AED {type.price}
                  </p>
                </button>
              )
            })
          ) : (
            HOURLY_OPTIONS.map((opt) => {
              const isSelected = selectedDuration === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => onDurationSelect(opt.value)}
                  className={`
                    flex-shrink-0 w-32 snap-start p-4 rounded-xl border-2 text-left transition-all
                    ${isSelected
                      ? 'border-emerald-500 bg-emerald-50 shadow-md'
                      : 'border-stone-100 bg-white hover:border-emerald-100'
                    }
                  `}
                >
                  <div className={`w-8 h-8 rounded-lg mb-3 flex items-center justify-center ${isSelected ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-50 text-stone-400'
                    }`}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <p className={`font-bold text-sm mb-1 ${isSelected ? 'text-emerald-900' : 'text-stone-700'}`}>
                    {opt.label}
                  </p>
                  <p className={`text-sm font-bold ${isSelected ? 'text-emerald-600' : 'text-stone-900'}`}>
                    AED {opt.price}
                  </p>
                </button>
              )
            })
          )}
        </div>

        {/* Right Scroll Button */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm border border-stone-200 rounded-full p-2 shadow-lg text-stone-600 hover:text-emerald-600 hover:border-emerald-200 transition-all opacity-0 group-hover:opacity-100 -mr-3"
          aria-label="Scroll right"
        >
          <ChevronLeft className="w-5 h-5 rotate-180" />
        </button>
      </div>
    </div>
  );
};

const ScheduleBookingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, getAuthHeaders } = useAuth();

  // Get default mode from location state
  const defaultMode = location.state?.defaultMode || 'single';

  // State
  const [bookingType, setBookingType] = useState('schedule'); // 'instant' or 'schedule'
  const [isMultipleMode, setIsMultipleMode] = useState(false); // Toggle for single vs multiple/custom
  const scheduleMode = isMultipleMode ? 'custom' : 'single'; // Derived mode

  const [bookingMethod, setBookingMethod] = useState(location.state?.bookingMethod || 'size'); // 'size' or 'hourly'
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]); // Weekdays default
  const [selectedPeriod, setSelectedPeriod] = useState('morning');
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState(120); // Default to 2 hours
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [addOnPrices, setAddOnPrices] = useState({});
  const [paymentMode, setPaymentMode] = useState('now'); // 'now' or 'later'
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState(null);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      toast.info('Please login to book a cleaning');
      navigate('/login', { state: { from: '/schedule-booking' } });
    }
  }, [user, navigate]);

  // Fetch services and set initial selection
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await axios.get(`${API}/services`);
        if (response.data) {
          // Filter to only show relevant booking types
          const allowedServices = ['Standard Cleaning', 'Deep Cleaning', 'Move In/Out'];
          const filteredServices = response.data.filter(s =>
            allowedServices.some(allowed => s.name.includes(allowed) || s.title?.includes(allowed))
          );
          setServices(filteredServices);

          // Determine initial service ID
          if (location.state?.serviceId) {
            setServiceId(location.state.serviceId);
            // Show modal on initial load if coming from previous selection
            setShowFeaturesModal(true);
          } else if (filteredServices.length > 0) {
            // Default to first available or specifically House Cleaning if present
            const defaultService = filteredServices.find(s => s.slug === 'house-cleaning') || filteredServices[0];
            setServiceId(defaultService.id);
          }
        }
      } catch (error) {
        console.error('Error fetching services:', error);
      }
    };
    fetchServices();
  }, [location.state]);

  const handleServiceSelect = (id) => {
    setServiceId(id);
    setShowFeaturesModal(true);
  };

  // Fetch addresses and auto-select default
  useEffect(() => {
    const fetchAddresses = async () => {
      if (!user) return;
      try {
        const response = await axios.get(`${API}/users/me/addresses`, {
          headers: getAuthHeaders()
        });
        if (response.data && response.data.length > 0) {
          const defaultAddr = response.data.find(a => a.is_default) || response.data[0];
          setSelectedAddress(defaultAddr);
        }
      } catch (error) {
        console.error('Error fetching addresses:', error);
      }
    };
    fetchAddresses();
  }, [user]);

  const handleAddOnToggle = (id) => {
    setSelectedAddOns(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAddOnsLoaded = (data) => {
    const prices = {};
    data.forEach(addon => {
      prices[addon.id] = addon.price;
    });
    setAddOnPrices(prices);
  };

  // Calculate final dates based on mode
  const finalDates = useMemo(() => {
    if (bookingType === 'instant') {
      return [new Date()]; // Today/Now
    }

    if (scheduleMode === 'single') {
      return selectedDate ? [selectedDate] : [];
    }

    // Multiple removed as per request

    if (scheduleMode === 'custom') {
      if (selectedRange?.start && selectedRange?.end && selectedDays.length > 0) {
        const allDates = eachDayOfInterval({ start: selectedRange.start, end: selectedRange.end });
        return allDates.filter(date => selectedDays.includes(date.getDay()));
      }
      return [];
    }

    return [];
  }, [bookingType, scheduleMode, selectedDate, selectedRange, selectedDays]);

  // Calculate price based on duration standard rate (~75 AED/hr)
  const priceMap = {
    60: { price: 75, original: 95 },
    90: { price: 115, original: 145 },
    120: { price: 150, original: 190 }
  };

  const currentPrice = priceMap[selectedDuration] || priceMap[90];
  const addOnsTotal = selectedAddOns.reduce((sum, id) => sum + (addOnPrices[id] || 0), 0);

  // Total per visit = Base + AddOns
  const singleVisitTotal = currentPrice.price + addOnsTotal;
  const totalPrice = singleVisitTotal * finalDates.length;

  // Original price calculation for savings display (Base original + AddOns)
  const singleVisitOriginal = currentPrice.original + addOnsTotal;
  const totalOriginal = singleVisitOriginal * finalDates.length;

  const savings = totalOriginal - totalPrice;

  // Validation
  const isValid = finalDates.length > 0 && selectedTime && selectedAddress && serviceId;

  // Handle booking
  const handleBookNow = async () => {
    if (!isValid) {
      toast.error('Please complete all selections');
      return;
    }

    setLoading(true);

    try {
      // Create booking(s)
      const bookingPromises = finalDates.map(date => {
        let scheduledDateTime;

        if (bookingType === 'instant') {
          // Instant: Cleaner arrives within 2 hours (e.g., set to 1 hour from now as target)
          scheduledDateTime = new Date(Date.now() + 60 * 60 * 1000);
        } else {
          // Scheduled: Use selected time
          const [hours, minutes] = selectedTime.split(':');
          scheduledDateTime = new Date(date);
          scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        }

        const bookingData = {
          service_id: serviceId,
          booking_type: bookingType === 'instant' ? 'instant' : 'single', // Pass instant type if backend supports or just single
          scheduled_date: scheduledDateTime.toISOString(),
          duration_minutes: selectedDuration,
          address_id: selectedAddress.id,
          add_on_ids: selectedAddOns,
          customer_notes: `${scheduleMode} booking`,
          // Default property details
          property_size_sqft: 1000,
          bedrooms: 0,
          bathrooms: 1,
          payment_method: paymentMode === 'now' ? 'card' : 'cash'
        };

        return axios.post(`${API}/bookings/`, bookingData, {
          headers: getAuthHeaders()
        });
      });

      await Promise.all(bookingPromises);

      toast.success(`${finalDates.length} booking${finalDates.length > 1 ? 's' : ''} confirmed!`);

      // Navigate to success page
      navigate('/booking/success', {
        state: {
          bookingCount: finalDates.length,
          isScheduled: true
        }
      });
    } catch (error) {
      console.error(error);
      const message = error.response?.data?.detail || 'Failed to create booking';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Reset selections when mode changes
  useEffect(() => {
    setSelectedDate(null);
    setSelectedRange(null);
    setSelectedDates([]);
  }, [scheduleMode]);

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />

      {/* Header */}
      <div className="bg-gradient-to-r from-green-800 to-green-900 pt-24 pb-8">
        <div className="max-w-4xl mx-auto px-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-white/80 hover:text-white mb-4 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <CalendarClock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Schedule Cleaning</h1>
              <p className="text-green-200">Plan your cleaning in advance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Selections */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Selection */}
            {services.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <label className="text-base font-semibold text-green-900">
                    Select Service
                  </label>
                </div>
                <ServiceSelector
                  services={services}
                  selectedServiceId={serviceId}
                  onSelect={handleServiceSelect}
                />
              </div>
            )}

            {/* Booking Duration & Method (House Size vs Hourly) */}
            <BookingDurationSection
              bookingMethod={bookingMethod}
              setBookingMethod={setBookingMethod}
              selectedDuration={selectedDuration}
              onDurationSelect={setSelectedDuration}
            />

            {/* Schedule Type Selection */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
              <label className="text-base font-semibold text-green-900 mb-4 block">
                Booking Type
              </label>

              {/* Level 1: Instant vs Schedule */}
              <ScheduleTabs
                activeMode={bookingType}
                onModeChange={(mode) => {
                  setBookingType(mode);
                  // Reset selections when switching
                  setSelectedDate(null);
                  setSelectedRange(null);
                  if (mode === 'instant') {
                    // Auto-select "ASAP" time for validation
                    setSelectedTime('ASAP');
                  } else {
                    setSelectedTime(null);
                  }
                }}
                modes={MAIN_BOOKING_MODES}
              />
            </div>

            {/* Date Selection (Only if Schedule) */}
            {bookingType === 'schedule' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-emerald-600" />
                    <label className="text-base font-semibold text-green-900">
                      {isMultipleMode ? 'Select Days & Range' : 'Select Date'}
                    </label>
                  </div>

                  {/* Multiple/Custom Toggle */}
                  <button
                    onClick={() => setIsMultipleMode(!isMultipleMode)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isMultipleMode
                      ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                  >
                    {isMultipleMode ? (
                      <ToggleRight className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-stone-400" />
                    )}
                    Need Recurring Schedule?
                  </button>
                </div>

                {/* Custom Mode - Weekday Selection First */}
                {isMultipleMode && (
                  <div className="mb-6 animate-in slide-in-from-top-2 duration-200">
                    <p className="text-xs text-stone-500 mb-2">Repeat on these days</p>
                    <WeekdayChips
                      selectedDays={selectedDays}
                      onDaysChange={setSelectedDays}
                      showPresets={true}
                      compact={false}
                    />
                  </div>
                )}

                {/* Date Picker */}
                <EnhancedDatePicker
                  mode={isMultipleMode ? 'range' : 'single'}
                  selectedDate={selectedDate}
                  selectedRange={selectedRange}
                  onDateSelect={setSelectedDate}
                  onRangeSelect={setSelectedRange}
                  showQuickOptions={!isMultipleMode}
                />
              </div>
            )}

            {/* Time Selection - Hidden for Instant (Auto-ASAP) */}
            {finalDates.length > 0 && bookingType !== 'instant' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
                <TimePeriodSelector
                  selectedPeriod={selectedPeriod}
                  selectedTime={selectedTime}
                  onPeriodChange={setSelectedPeriod}
                  onTimeChange={setSelectedTime}
                  showTimeSlots={true}
                  selectedDate={finalDates[0]}
                />
              </div>
            )}

            {/* Instant Mode Info */}
            {bookingType === 'instant' && (
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 flex items-start gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <Zap className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-emerald-900">Priority Dispatch</h4>
                  <p className="text-sm text-emerald-700">
                    A cleaner will be assigned immediately and arrive within 90 minutes.
                  </p>
                </div>
              </div>
            )}


            {/* Add-Ons Selection */}
            {(bookingType === 'instant' || (finalDates.length > 0 && selectedTime)) && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
                <AddOnSelector
                  selectedAddOns={selectedAddOns}
                  onAddOnToggle={handleAddOnToggle}
                  onDataLoaded={handleAddOnsLoaded}
                />
              </div>
            )}
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 sticky top-24">
              <h3 className="font-semibold text-green-900 mb-4">Booking Summary</h3>

              {/* Selected items */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-600 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Type
                  </span>
                  <span className="font-medium capitalize">
                    {bookingType === 'instant' ? 'Instant' : 'Scheduled'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-600 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" />
                    Visits
                  </span>
                  <span className="font-medium">{finalDates.length}</span>
                </div>

                {finalDates.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-600 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Duration
                    </span>
                    <span className="font-medium">{selectedDuration} min</span>
                  </div>
                )}

                {selectedTime && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-600 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Time
                    </span>
                    <span className="font-medium">
                      {bookingType === 'instant' ? (
                        <span className="text-emerald-600 flex items-center gap-1 font-bold">
                          <Zap className="w-3 h-3" /> ASAP
                        </span>
                      ) : (
                        (() => {
                          const [h, m] = selectedTime.split(':');
                          // Handle potential ASAP string just in case
                          if (h === 'ASAP') return 'ASAP';
                          const hour = parseInt(h);
                          const period = hour >= 12 ? 'PM' : 'AM';
                          const displayHour = hour > 12 ? hour - 12 : (hour === 0 || hour === 12 ? 12 : hour);
                          return `${displayHour}:${m} ${period}`;
                        })()
                      )}
                    </span>
                  </div>
                )}

                {selectedAddress && (
                  <div className="flex items-start justify-between text-sm">
                    <span className="text-stone-600 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Location
                    </span>
                    <span className="font-medium text-right max-w-[150px] truncate">
                      {selectedAddress.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Payment Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-stone-700 mb-2">Payment Option</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMode('now')}
                    className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${paymentMode === 'now'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500'
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                  >
                    Pay Now
                  </button>
                  <button
                    onClick={() => setPaymentMode('later')}
                    className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${paymentMode === 'later'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500'
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                  >
                    Pay Later
                  </button>
                </div>
                {paymentMode === 'now' ? (
                  <p className="text-xs text-stone-500 mt-2 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-500" /> Secure checkout with card/wallet
                  </p>
                ) : (
                  <p className="text-xs text-stone-500 mt-2 flex items-center gap-1">
                    <Banknote className="w-3 h-3 text-emerald-500" /> Pay in cash after each service is completed
                  </p>
                )}
              </div>

              {selectedAddOns.length > 0 && (
                <div className="border-t border-stone-100 pt-3 mb-3">
                  <p className="text-xs text-stone-500 mb-2">Add-Ons (Per Visit)</p>
                  <div className="space-y-1">
                    {selectedAddOns.map(id => (
                      <div key={id} className="flex justify-between text-sm">
                        <span className="text-stone-600">Add-on Item</span>
                        <span className="font-medium text-emerald-600">+AED {addOnPrices[id] || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates Preview */}
              {finalDates.length > 0 && finalDates.length <= 5 && (
                <div className="border-t border-stone-100 pt-4 mb-4">
                  <p className="text-xs text-stone-500 mb-2">Scheduled Dates</p>
                  <div className="flex flex-wrap gap-1">
                    {finalDates.map((date, idx) => (
                      <span key={idx} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">
                        {format(date, 'MMM d')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Price */}
              {finalDates.length > 0 && (
                <div className="border-t border-stone-100 pt-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-stone-600">
                      {finalDates.length} x AED {singleVisitTotal}
                    </span>
                    <span className="text-stone-500 line-through">AED {totalOriginal}</span>
                  </div>
                  {savings > 0 && (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-stone-600">Savings</span>
                      <span className="text-emerald-600">-AED {savings}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-lg font-bold">
                    <span className="text-green-900">Total</span>
                    <span className="text-emerald-600">AED {totalPrice}</span>
                  </div>
                </div>
              )}

              {/* Payment Method */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <div className="flex items-center gap-2 text-amber-800">
                  <Banknote className="w-5 h-5" />
                  <span className="font-medium text-sm">Pay Later (Cash)</span>
                </div>
                <p className="text-xs text-amber-600 mt-1">
                  Pay in cash after each service is completed
                </p>
              </div>

              {/* Book Button */}
              <Button
                onClick={handleBookNow}
                disabled={!isValid || loading}
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Confirm {finalDates.length > 1 ? `${finalDates.length} Bookings` : 'Booking'}
                  </>
                )}
              </Button>

              {/* Trust badges */}
              <div className="mt-4 pt-4 border-t border-stone-100">
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span>Verified cleaners • Insured • Satisfaction guaranteed</span>
                </div>
              </div>

              {/* Validation message */}
              {!isValid && (
                <div className="mt-4 flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    {finalDates.length === 0
                      ? 'Please select date(s)'
                      : !selectedTime
                        ? 'Please select a time'
                        : !selectedAddress
                          ? 'Please check your address settings'
                          : 'Complete all selections to continue'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div >

      <Footer />

      {/* Mobile sticky footer */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-4 z-50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-stone-500">{finalDates.length} visit{finalDates.length !== 1 ? 's' : ''}</p>
            <p className="text-xl font-bold text-emerald-600">AED {totalPrice}</p>
          </div>
          <Button
            onClick={handleBookNow}
            disabled={!isValid || loading}
            className="h-12 px-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Confirm
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="h-24 lg:hidden" />

      {/* Service Features Modal */}
      <ServiceFeaturesModal
        isOpen={showFeaturesModal}
        onClose={() => setShowFeaturesModal(false)}
        service={services.find(s => s.id === serviceId)}
      />
    </div >
  );
};

export default ScheduleBookingPage;
