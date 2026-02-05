import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import DurationSelector from '../components/booking/DurationSelector';
import AddOnSelector from '../components/booking/AddOnSelector';
import AddressSelector from '../components/booking/AddressSelector';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Zap,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  ChevronLeft,
  Users,
  Banknote,
  Shield
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const InstantBookingPage = () => {
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuth();

  // Today's date
  const today = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  // State
  const [selectedDuration, setSelectedDuration] = useState(90); // Default 90 min
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [addOnPrices, setAddOnPrices] = useState({});
  const [unavailableSlots, setUnavailableSlots] = useState([]);
  const [expertCount, setExpertCount] = useState(12); // Mock count
  const [loading, setLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [serviceId, setServiceId] = useState(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      toast.info('Please login to book a cleaning');
      navigate('/login', { state: { from: '/instant-booking' } });
    }
  }, [user, navigate]);

  // Fetch availability and correct service ID when component mounts
  useEffect(() => {
    fetchAvailability();
    fetchServiceId();
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      const response = await axios.get(`${API}/users/me/addresses`, {
        headers: getAuthHeaders()
      });
      if (response.data && response.data.length > 0) {
        // Auto-select default or first address
        const defaultAddr = response.data.find(a => a.is_default) || response.data[0];
        setSelectedAddress(defaultAddr);
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
    }
  };

  const fetchServiceId = async () => {
    try {
      const response = await axios.get(`${API}/services`);
      if (response.data) {
        // Find 'house-cleaning' or use the first one
        const manualService = response.data.find(s => s.slug === 'house-cleaning');
        setServiceId(manualService ? manualService.id : response.data[0]?.id);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      // Fallback ID if fetch fails, but this is risky
      setServiceId(1);
    }
  };

  const fetchAvailability = async () => {
    setCheckingAvailability(true);
    try {
      // Try to fetch from API, fallback to mock data
      const response = await axios.get(`${API}/availability/slots`, {
        params: { date: today }
      }).catch(() => null);

      if (response?.data) {
        setUnavailableSlots(response.data.unavailable_slots || []);
        setExpertCount(response.data.available_experts || 12);
      } else {
        // Mock some unavailable slots for demo
        setUnavailableSlots(['09:00', '09:15', '14:30', '14:45', '15:00']);
        setExpertCount(Math.floor(Math.random() * 8) + 5);
      }
    } catch (error) {
      console.log('Using mock availability data');
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Add-On Handlers
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

  // Calculate price
  const priceMap = {
    60: { price: 85, original: 100 },
    90: { price: 125, original: 150 },
    120: { price: 170, original: 200 }
  };

  const currentPrice = priceMap[selectedDuration] || priceMap[90];
  const addOnsTotal = selectedAddOns.reduce((sum, id) => sum + (addOnPrices[id] || 0), 0);
  const finalTotal = currentPrice.price + addOnsTotal;
  const savings = currentPrice.original - currentPrice.price;

  // Validation
  const isValid = selectedDuration && selectedAddress && serviceId;

  // Handle booking
  const handleBookNow = async () => {
    if (!isValid) {
      toast.error('Please complete all selections');
      return;
    }

    setLoading(true);

    try {
      // For Instant Booking: Schedule for NOW + 60 mins
      const instantDate = new Date();
      instantDate.setMinutes(instantDate.getMinutes() + 60);

      // Create booking payload
      const bookingData = {
        service_id: serviceId,
        booking_type: 'instant',
        scheduled_date: instantDate.toISOString(),
        duration_minutes: selectedDuration,
        address_id: selectedAddress.id,
        add_on_ids: selectedAddOns,
        customer_notes: 'Instant booking - ASAP',
        // Default property details
        property_size_sqft: 1000,
        bedrooms: 0,
        bathrooms: 1
      };

      const response = await axios.post(`${API}/bookings/`, bookingData, {
        headers: getAuthHeaders()
      });

      toast.success('Booking confirmed! A cleaner is on their way.');

      // Navigate to success page
      navigate('/booking/success', {
        state: {
          booking: response.data,
          isInstant: true
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

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-green-700 pt-24 pb-8">
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
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Instant Booking</h1>
              <p className="text-emerald-100">Get a cleaner within 60 minutes</p>
            </div>
          </div>

          {/* Today's date banner */}
          <div className="mt-4 flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl px-4 py-3">
            <Clock className="w-5 h-5 text-white" />
            <span className="text-white font-medium">Arriving by {(() => {
              const d = new Date();
              d.setMinutes(d.getMinutes() + 60);
              return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            })()}</span>
            {expertCount > 0 && (
              <span className="ml-auto flex items-center gap-1.5 bg-lime-400/20 text-lime-100 px-3 py-1 rounded-full text-sm">
                <Users className="w-4 h-4" />
                {expertCount} experts available
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Selections */}
          <div className="lg:col-span-2 space-y-6">
            {/* Duration Selection */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
              <DurationSelector
                selectedDuration={selectedDuration}
                onSelect={setSelectedDuration}
                currency="AED"
              />
            </div>

            {/* Add-Ons Selection */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
              <AddOnSelector
                selectedAddOns={selectedAddOns}
                onAddOnToggle={handleAddOnToggle}
                onDataLoaded={handleAddOnsLoaded}
              />
            </div>
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
                    Date
                  </span>
                  <span className="font-medium">Today</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-600 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Duration
                  </span>
                  <span className="font-medium">{selectedDuration} min</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-600 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Time
                  </span>
                  <span className="font-medium text-emerald-600 font-bold">
                    Instant (ASAP)
                  </span>
                </div>

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

              {/* Add-Ons Summary */}
              {selectedAddOns.length > 0 && (
                <div className="border-t border-stone-100 pt-3 mb-3">
                  <p className="text-xs text-stone-500 mb-2">Add-Ons</p>
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

              {/* Price */}
              <div className="border-t border-stone-100 pt-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-stone-600">Subtotal</span>
                  <span className="text-stone-500 line-through">AED {currentPrice.original}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-stone-600">Discount</span>
                  <span className="text-emerald-600">-AED {savings}</span>
                </div>
                <div className="flex items-center justify-between text-lg font-bold">
                  <span className="text-green-900">Total</span>
                  <span className="text-emerald-600">AED {finalTotal}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <div className="flex items-center gap-2 text-amber-800">
                  <Banknote className="w-5 h-5" />
                  <span className="font-medium text-sm">Pay Later (Cash)</span>
                </div>
                <p className="text-xs text-amber-600 mt-1">
                  Pay in cash after the service is completed
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
                    Confirm Booking
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
                    {!selectedAddress
                      ? 'Please check your address settings'
                      : 'Complete all selections to continue'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />

      {/* Mobile sticky footer */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-4 z-50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-stone-500">Total</p>
            <p className="text-xl font-bold text-emerald-600">AED {finalTotal}</p>
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
    </div>
  );
};

export default InstantBookingPage;
