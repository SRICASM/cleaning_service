import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { toast } from 'sonner';
import axios from 'axios';
import { format } from 'date-fns';
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Check,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  CreditCard,
  Home,
  Building,
  Building2,
  Store,
  Plus,
  Minus,
  Navigation,
  Loader2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BookingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getAuthHeaders, user } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [addOns, setAddOns] = useState([]);

  // Booking data
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Address Selection State
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [newAddress, setNewAddress] = useState({
    address: '',
    city: '',
    postal_code: ''
  });
  const [geoLoading, setGeoLoading] = useState(false);

  const propertyTypes = [
    { id: 'apartment', name: 'Apartment', icon: Building },
    { id: 'house', name: 'House', icon: Home },
    { id: 'office', name: 'Office', icon: Building2 },
    { id: 'commercial', name: 'Commercial', icon: Store },
  ];

  const timeSlots = [
    '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM',
    '04:00 PM', '05:00 PM'
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [servicesRes, addOnsRes] = await Promise.all([
          axios.get(`${API}/services`),
          axios.get(`${API}/services/add-ons/`)
        ]);
        setServices(servicesRes.data);
        setAddOns(addOnsRes.data);

        const preselectedService = searchParams.get('service');
        if (preselectedService) {
          const service = servicesRes.data.find(s => s.id === preselectedService);
          if (service) setSelectedService(service);
        }
      } catch (error) {
        toast.error('Failed to load services');
      }
    };
    fetchData();
  }, [searchParams]);

  // Set default address when user data loads
  useEffect(() => {
    if (user?.addresses && user.addresses.length > 0) {
      const defaultAddr = user.addresses.find(a => a.is_default);
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
      } else {
        setSelectedAddressId(user.addresses[0].id);
      }
    } else {
      setUseNewAddress(true);
    }
  }, [user]);

  const calculateTotal = () => {
    if (!selectedService) return '0.00';
    let total = parseFloat(selectedService.base_price) || 0;
    selectedAddOns.forEach(addonId => {
      const addon = addOns.find(a => a.id === addonId);
      if (addon) total += parseFloat(addon.price) || 0;
    });
    return total.toFixed(2);
  };

  const toggleAddOn = (addonId) => {
    setSelectedAddOns(prev =>
      prev.includes(addonId)
        ? prev.filter(id => id !== addonId)
        : [...prev, addonId]
    );
  };

  const validateStep = () => {
    switch (step) {
      case 1:
        if (!selectedService) {
          toast.error('Please select a service');
          return false;
        }
        return true;
      case 2:
        if (!selectedDate || !selectedTime) {
          toast.error('Please select date and time');
          return false;
        }
        return true;
      case 3:
        if (useNewAddress) {
          if (!newAddress.address || !newAddress.city || !newAddress.postal_code) {
            toast.error('Please fill in all address fields');
            return false;
          }
        } else if (!selectedAddressId) {
          toast.error('Please select an address');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const isTimeSlotDisabled = (time) => {
    if (!selectedDate) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkDate = new Date(selectedDate);
    checkDate.setHours(0, 0, 0, 0);

    // If date is in past (shouldn't happen with calendar disabled prop)
    if (checkDate < today) return true;

    // If future date, enable all slots
    if (checkDate > today) return false;

    // It is today, check time buffer
    const [timeStr, modifier] = time.split(' ');
    let [hours, minutes] = timeStr.split(':');
    hours = parseInt(hours, 10);
    minutes = parseInt(minutes, 10);

    if (hours === 12) hours = 0;
    if (modifier === 'PM') hours += 12;

    const slotTime = new Date();
    slotTime.setHours(hours, minutes, 0, 0);

    const now = new Date();
    // 45 minute buffer
    const bufferTime = new Date(now.getTime() + 45 * 60 * 1000);

    return slotTime < bufferTime;
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep(prev => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    if (step === 1) {
      navigate(-1);
    } else {
      setStep(prev => prev - 1);
    }
  };

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setGeoLoading(true);
    setUseNewAddress(true); // Switch to new address mode

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = response.data;
          if (data && data.address) {
            setNewAddress({
              address: `${data.address.road || ''} ${data.address.house_number || ''}`.trim() || data.display_name?.split(',')[0] || '',
              city: data.address.city || data.address.town || data.address.village || data.address.municipality || '',
              postal_code: data.address.postcode || ''
            });
            toast.success('Location detected!');
          }
        } catch (error) {
          toast.error('Could not get address from location');
        } finally {
          setGeoLoading(false);
        }
      },
      (error) => {
        setGeoLoading(false);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('Location permission denied');
        } else {
          toast.error('Could not get your location');
        }
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setLoading(true);
    try {
      let addressId = null;

      if (useNewAddress) {
        // Create new address first
        const addressRes = await axios.post(`${API}/users/me/addresses`, {
          label: "Service Location",
          street_address: newAddress.address,
          city: newAddress.city,
          postal_code: newAddress.postal_code,
          property_type: user?.property_type || 'house',
          bedrooms: user?.bedrooms || 2,
          bathrooms: user?.bathrooms || 1,
          is_default: false
        }, {
          headers: getAuthHeaders()
        });
        addressId = addressRes.data.id;
      } else {
        addressId = selectedAddressId;
      }

      if (!addressId) {
        toast.error('Please select or enter an address');
        setLoading(false);
        return;
      }

      // Combine date and time into ISO datetime
      const [time, period] = selectedTime.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      const bookingData = {
        service_id: selectedService.id,
        address_id: addressId,
        scheduled_date: scheduledDateTime.toISOString(),
        property_size_sqft: 1000, // Default size, could be from user profile
        bedrooms: user?.bedrooms || 2,
        bathrooms: user?.bathrooms || 1,
        add_on_ids: selectedAddOns,
        customer_notes: specialInstructions || null,
        discount_code: null
      };

      const bookingRes = await axios.post(`${API}/bookings`, bookingData, {
        headers: getAuthHeaders()
      });

      // Skip payment for testing - redirect directly to success page
      toast.success('Booking confirmed!');
      navigate(`/booking/success?session_id=test_${bookingRes.data.id}`);
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      if (typeof errorDetail === 'string') {
        toast.error(errorDetail);
      } else if (Array.isArray(errorDetail)) {
        toast.error(errorDetail.map(e => e.msg).join(', '));
      } else {
        toast.error('Failed to create booking');
      }
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: 'Service' },
    { number: 2, title: 'Schedule' },
    { number: 3, title: 'Review' },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 py-4">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-green-900" />
            <span className="font-heading font-bold text-xl text-green-900">CleanUpCrew</span>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b border-stone-200 py-6">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-between">
            {steps.map((s, index) => (
              <div key={s.number} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`step-indicator ${step > s.number ? 'completed' : step === s.number ? 'active' : 'inactive'
                      }`}
                  >
                    {step > s.number ? <Check className="w-5 h-5" /> : s.number}
                  </div>
                  <span className={`mt-2 text-sm font-medium ${step >= s.number ? 'text-green-900' : 'text-stone-400'
                    }`}>
                    {s.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 md:w-32 h-0.5 mx-2 md:mx-4 ${step > s.number ? 'bg-lime-500' : 'bg-stone-200'
                    }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="py-10">
        <div className="max-w-4xl mx-auto px-6">
          {/* Step 1: Select Service */}
          {step === 1 && (
            <div className="animate-fadeIn">
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-green-900 mb-2">
                Choose Your Service
              </h2>
              <p className="text-stone-600 mb-8">
                Select the cleaning service that best fits your needs.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                {services.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`selection-card ${selectedService?.id === service.id ? 'selected' : ''}`}
                    data-testid={`select-service-${service.id}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-heading text-xl font-semibold text-green-900">
                        {service.name}
                      </h3>
                      {selectedService?.id === service.id && (
                        <div className="w-6 h-6 rounded-full bg-green-900 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-stone-600 text-sm mb-4">{service.short_description}</p>
                    <p className="font-heading text-2xl font-bold text-lime-700">
                      From ${service.base_price}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* Step 2: Schedule */}
          {step === 2 && (
            <div className="animate-fadeIn">
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-green-900 mb-2">
                Pick a Date & Time
              </h2>
              <p className="text-stone-600 mb-8">
                Choose when you'd like us to come clean.
              </p>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Calendar */}
                <div>
                  <Label className="text-base font-medium mb-4 block">Select Date</Label>
                  <div className="bg-white rounded-2xl border border-stone-200 p-4">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return date < today;
                      }}
                      className="rounded-md"
                      data-testid="booking-calendar"
                    />
                  </div>
                </div>

                {/* Time Slots */}
                <div>
                  <Label className="text-base font-medium mb-4 block">Select Time</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {timeSlots.map((time) => {
                      const isDisabled = isTimeSlotDisabled(time);
                      return (
                        <button
                          key={time}
                          onClick={() => !isDisabled && setSelectedTime(time)}
                          disabled={isDisabled}
                          className={`p-4 rounded-xl border-2 font-medium transition-all ${isDisabled
                            ? 'opacity-40 cursor-not-allowed bg-stone-100 text-stone-400 border-stone-100'
                            : selectedTime === time
                              ? 'border-green-900 bg-green-50 text-green-900'
                              : 'border-stone-200 hover:border-green-900/30'
                            }`}
                          data-testid={`time-${time.replace(/\s/g, '-')}`}
                        >
                          <Clock className="w-4 h-4 inline-block mr-2" />
                          {time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Add-ons */}
              <div className="mt-10">
                <Label className="text-base font-medium mb-4 block">Add Extra Services (Optional)</Label>
                <div className="grid md:grid-cols-2 gap-4">
                  {addOns.map((addon) => (
                    <div
                      key={addon.id}
                      onClick={() => toggleAddOn(addon.id)}
                      className={`selection-card flex items-center justify-between ${selectedAddOns.includes(addon.id) ? 'selected' : ''
                        }`}
                      data-testid={`addon-${addon.id}`}
                    >
                      <div>
                        <h4 className="font-medium text-green-900">{addon.name}</h4>
                        <p className="text-sm text-stone-500">{addon.description}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-lime-700">+${addon.price}</span>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedAddOns.includes(addon.id)
                          ? 'bg-green-900 border-green-900'
                          : 'border-stone-300'
                          }`}>
                          {selectedAddOns.includes(addon.id) && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Instructions */}
              <div className="mt-8">
                <Label htmlFor="instructions" className="text-base font-medium">Special Instructions (Optional)</Label>
                <Textarea
                  id="instructions"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Any special requests or access instructions..."
                  className="mt-2"
                  rows={3}
                  data-testid="special-instructions"
                />
              </div>
            </div>
          )}

          {/* Step 3: Review & Pay */}
          {step === 3 && (
            <div className="animate-fadeIn">
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-green-900 mb-2">
                Review Your Booking
              </h2>
              <p className="text-stone-600 mb-8">
                Please review your booking details and update the location if needed.
              </p>

              <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
                {/* Service */}
                <div className="p-6 border-b border-stone-100">
                  <div className="flex items-center gap-2 text-sm text-stone-500 mb-2">
                    <Sparkles className="w-4 h-4" />
                    Service
                  </div>
                  <h3 className="font-heading text-xl font-semibold text-green-900">
                    {selectedService?.name}
                  </h3>
                </div>

                {/* Location Selection */}
                <div className="p-6 border-b border-stone-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm text-stone-500">
                      <MapPin className="w-4 h-4" />
                      Location
                    </div>
                    <button
                      onClick={handleUseCurrentLocation}
                      disabled={geoLoading}
                      className="text-sm text-green-700 hover:text-green-900 flex items-center gap-1 font-medium"
                    >
                      {geoLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Navigation className="w-3 h-3" />
                      )}
                      Use Current Location
                    </button>
                  </div>

                  {user?.addresses && user.addresses.length > 0 && (
                    <div className="mb-4 space-y-3">
                      {user.addresses.map((addr) => (
                        <div
                          key={addr.id}
                          onClick={() => {
                            setSelectedAddressId(addr.id);
                            setUseNewAddress(false);
                          }}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${!useNewAddress && selectedAddressId === addr.id
                            ? 'border-green-600 bg-green-50'
                            : 'border-stone-200 hover:border-green-200'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${!useNewAddress && selectedAddressId === addr.id
                              ? 'border-green-600 bg-green-600'
                              : 'border-stone-300'
                              }`}>
                              {!useNewAddress && selectedAddressId === addr.id && (
                                <div className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-green-900">{addr.label}</p>
                              <p className="text-sm text-stone-500">{addr.address}, {addr.city}</p>
                            </div>
                          </div>
                          {addr.is_default && <span className="text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-500">Default</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    onClick={() => setUseNewAddress(true)}
                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all mb-4 ${useNewAddress
                      ? 'border-green-600 bg-green-50'
                      : 'border-stone-200 hover:border-green-200'
                      }`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${useNewAddress
                      ? 'border-green-600 bg-green-600'
                      : 'border-stone-300'
                      }`}>
                      {useNewAddress && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="font-medium text-green-900">Enter a new address</span>
                  </div>

                  {useNewAddress && (
                    <div className="space-y-3 pl-2 border-l-2 border-green-100 ml-4 animate-fadeIn">
                      <div>
                        <Label htmlFor="address">Street Address</Label>
                        <Input
                          id="address"
                          value={newAddress.address}
                          onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                          placeholder="123 Main St"
                          className="mt-1"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            value={newAddress.city}
                            onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                            placeholder="City"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="postal">Postal Code</Label>
                          <Input
                            id="postal"
                            value={newAddress.postal_code}
                            onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                            placeholder="Zip Code"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-stone-500 text-sm mt-4 pt-4 border-t border-stone-100">
                    Prop. Type: {propertyTypes.find(t => t.id === user?.property_type)?.name || 'House'} • {user?.bedrooms || 2} bed • {user?.bathrooms || 1} bath
                  </p>
                </div>

                {/* Schedule */}
                <div className="p-6 border-b border-stone-100">
                  <div className="flex items-center gap-2 text-sm text-stone-500 mb-2">
                    <CalendarIcon className="w-4 h-4" />
                    Schedule
                  </div>
                  <p className="text-green-900">
                    {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : ''} at {selectedTime}
                  </p>
                </div>

                {/* Price Breakdown */}
                <div className="p-6 bg-stone-50">
                  <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
                    <CreditCard className="w-4 h-4" />
                    Price Summary
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-stone-600">{selectedService?.name}</span>
                      <span className="text-green-900">${parseFloat(selectedService?.base_price || 0).toFixed(2)}</span>
                    </div>
                    {selectedAddOns.map((addonId) => {
                      const addon = addOns.find(a => a.id === addonId);
                      return addon ? (
                        <div key={addonId} className="flex justify-between">
                          <span className="text-stone-600">{addon.name}</span>
                          <span className="text-green-900">${parseFloat(addon.price || 0).toFixed(2)}</span>
                        </div>
                      ) : null;
                    })}
                    <div className="border-t border-stone-200 pt-3 mt-3">
                      <div className="flex justify-between">
                        <span className="font-heading font-semibold text-lg text-green-900">Total</span>
                        <span className="font-heading font-bold text-2xl text-lime-700">${calculateTotal()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-10 pt-6 border-t border-stone-200">
            <Button
              variant="outline"
              onClick={prevStep}
              className="rounded-full px-6"
              data-testid="booking-prev"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            {step < 3 ? (
              <Button
                onClick={nextStep}
                className="bg-green-900 hover:bg-green-800 text-white rounded-full px-8"
                data-testid="booking-next"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-lime-500 hover:bg-lime-600 text-white rounded-full px-8"
                data-testid="booking-submit"
              >
                {loading ? 'Processing...' : 'Proceed to Payment'}
                <CreditCard className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default BookingPage;
