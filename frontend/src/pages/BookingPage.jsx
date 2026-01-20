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
  Minus
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BookingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getAuthHeaders } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [addOns, setAddOns] = useState([]);

  // Booking data
  const [selectedService, setSelectedService] = useState(null);
  const [propertyType, setPropertyType] = useState('');
  const [propertySize, setPropertySize] = useState(1000);
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedAddOns, setSelectedAddOns] = useState([]);
  const [specialInstructions, setSpecialInstructions] = useState('');

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
          axios.get(`${API}/add-ons`)
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

  const calculateTotal = () => {
    if (!selectedService) return 0;
    let total = selectedService.base_price + (selectedService.price_per_sqft * propertySize);
    selectedAddOns.forEach(addonId => {
      const addon = addOns.find(a => a.id === addonId);
      if (addon) total += addon.price;
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
        if (!propertyType || !address || !city || !postalCode) {
          toast.error('Please fill in all address details');
          return false;
        }
        return true;
      case 3:
        if (!selectedDate || !selectedTime) {
          toast.error('Please select date and time');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep(prev => Math.min(prev + 1, 4));
    }
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Create booking
      const bookingData = {
        service_id: selectedService.id,
        service_name: selectedService.name,
        property_type: propertyType,
        property_size: propertySize,
        bedrooms: bedrooms,
        bathrooms: bathrooms,
        address: address,
        city: city,
        postal_code: postalCode,
        scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
        scheduled_time: selectedTime,
        add_ons: selectedAddOns,
        special_instructions: specialInstructions
      };

      const bookingRes = await axios.post(`${API}/bookings`, bookingData, {
        headers: getAuthHeaders()
      });

      // ============ PAYMENT BYPASS FOR TESTING ============
      // Uncomment the code below to restore Stripe payment integration
      // 
      // // Create payment session
      // const paymentRes = await axios.post(`${API}/payments/checkout`, {
      //   booking_id: bookingRes.data.id,
      //   origin_url: window.location.origin
      // }, {
      //   headers: getAuthHeaders()
      // });
      // 
      // // Redirect to Stripe
      // window.location.href = paymentRes.data.checkout_url;
      // =====================================================

      // Skip payment for testing - redirect directly to success page
      toast.success('Booking confirmed!');
      navigate(`/booking/success?session_id=test_${bookingRes.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: 'Service' },
    { number: 2, title: 'Details' },
    { number: 3, title: 'Schedule' },
    { number: 4, title: 'Review' },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 py-4">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-stone-600 hover:text-green-900"
            data-testid="booking-back"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-green-900" />
            <span className="font-heading font-bold text-xl text-green-900">BrightHome</span>
          </div>
          <div className="w-20" />
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
                    <p className="font-heading text-2xl font-bold text-lime-600">
                      From ${service.base_price}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Property Details */}
          {step === 2 && (
            <div className="animate-fadeIn">
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-green-900 mb-2">
                Property Details
              </h2>
              <p className="text-stone-600 mb-8">
                Tell us about your space so we can provide accurate pricing.
              </p>

              <div className="space-y-8">
                {/* Property Type */}
                <div>
                  <Label className="text-base font-medium mb-4 block">Property Type</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {propertyTypes.map((type) => (
                      <div
                        key={type.id}
                        onClick={() => setPropertyType(type.id)}
                        className={`selection-card text-center py-6 ${propertyType === type.id ? 'selected' : ''}`}
                        data-testid={`property-${type.id}`}
                      >
                        <type.icon className={`w-8 h-8 mx-auto mb-2 ${propertyType === type.id ? 'text-green-900' : 'text-stone-400'}`} />
                        <span className="font-medium">{type.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Size & Rooms */}
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="size">Property Size (sq ft)</Label>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => setPropertySize(Math.max(500, propertySize - 100))}
                        className="w-10 h-10 rounded-full border border-stone-300 flex items-center justify-center hover:bg-stone-100"
                        data-testid="size-decrease"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <Input
                        id="size"
                        type="number"
                        value={propertySize}
                        onChange={(e) => setPropertySize(parseInt(e.target.value) || 500)}
                        className="text-center"
                        data-testid="property-size"
                      />
                      <button
                        onClick={() => setPropertySize(propertySize + 100)}
                        className="w-10 h-10 rounded-full border border-stone-300 flex items-center justify-center hover:bg-stone-100"
                        data-testid="size-increase"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bedrooms">Bedrooms</Label>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => setBedrooms(Math.max(0, bedrooms - 1))}
                        className="w-10 h-10 rounded-full border border-stone-300 flex items-center justify-center hover:bg-stone-100"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <Input
                        id="bedrooms"
                        type="number"
                        value={bedrooms}
                        onChange={(e) => setBedrooms(parseInt(e.target.value) || 0)}
                        className="text-center"
                        data-testid="bedrooms"
                      />
                      <button
                        onClick={() => setBedrooms(bedrooms + 1)}
                        className="w-10 h-10 rounded-full border border-stone-300 flex items-center justify-center hover:bg-stone-100"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bathrooms">Bathrooms</Label>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => setBathrooms(Math.max(1, bathrooms - 1))}
                        className="w-10 h-10 rounded-full border border-stone-300 flex items-center justify-center hover:bg-stone-100"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <Input
                        id="bathrooms"
                        type="number"
                        value={bathrooms}
                        onChange={(e) => setBathrooms(parseInt(e.target.value) || 1)}
                        className="text-center"
                        data-testid="bathrooms"
                      />
                      <button
                        onClick={() => setBathrooms(bathrooms + 1)}
                        className="w-10 h-10 rounded-full border border-stone-300 flex items-center justify-center hover:bg-stone-100"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="address">Street Address</Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="123 Main Street, Apt 4B"
                      className="mt-2"
                      data-testid="address"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="San Francisco"
                        className="mt-2"
                        data-testid="city"
                      />
                    </div>
                    <div>
                      <Label htmlFor="postal">Postal Code</Label>
                      <Input
                        id="postal"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="94102"
                        className="mt-2"
                        data-testid="postal-code"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Schedule */}
          {step === 3 && (
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
                      disabled={(date) => date < new Date()}
                      className="rounded-md"
                      data-testid="booking-calendar"
                    />
                  </div>
                </div>

                {/* Time Slots */}
                <div>
                  <Label className="text-base font-medium mb-4 block">Select Time</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {timeSlots.map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`p-4 rounded-xl border-2 font-medium transition-all ${selectedTime === time
                            ? 'border-green-900 bg-green-50 text-green-900'
                            : 'border-stone-200 hover:border-green-900/30'
                          }`}
                        data-testid={`time-${time.replace(/\s/g, '-')}`}
                      >
                        <Clock className="w-4 h-4 inline-block mr-2" />
                        {time}
                      </button>
                    ))}
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
                        <span className="font-semibold text-lime-600">+${addon.price}</span>
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

          {/* Step 4: Review & Pay */}
          {step === 4 && (
            <div className="animate-fadeIn">
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-green-900 mb-2">
                Review Your Booking
              </h2>
              <p className="text-stone-600 mb-8">
                Please review your booking details before proceeding to payment.
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

                {/* Location */}
                <div className="p-6 border-b border-stone-100">
                  <div className="flex items-center gap-2 text-sm text-stone-500 mb-2">
                    <MapPin className="w-4 h-4" />
                    Location
                  </div>
                  <p className="text-green-900">
                    {address}, {city}, {postalCode}
                  </p>
                  <p className="text-stone-500 text-sm mt-1">
                    {propertyTypes.find(t => t.id === propertyType)?.name} • {propertySize} sq ft • {bedrooms} bed • {bathrooms} bath
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
                      <span className="text-green-900">${selectedService?.base_price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-600">Size adjustment ({propertySize} sq ft)</span>
                      <span className="text-green-900">${(selectedService?.price_per_sqft * propertySize).toFixed(2)}</span>
                    </div>
                    {selectedAddOns.map((addonId) => {
                      const addon = addOns.find(a => a.id === addonId);
                      return addon ? (
                        <div key={addonId} className="flex justify-between">
                          <span className="text-stone-600">{addon.name}</span>
                          <span className="text-green-900">${addon.price.toFixed(2)}</span>
                        </div>
                      ) : null;
                    })}
                    <div className="border-t border-stone-200 pt-3 mt-3">
                      <div className="flex justify-between">
                        <span className="font-heading font-semibold text-lg text-green-900">Total</span>
                        <span className="font-heading font-bold text-2xl text-lime-600">${calculateTotal()}</span>
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
              disabled={step === 1}
              className="rounded-full px-6"
              data-testid="booking-prev"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            {step < 4 ? (
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
