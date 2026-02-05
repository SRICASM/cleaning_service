import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import TrustSection from '../components/sections/TrustSection';
import ReviewsSection from '../components/sections/ReviewsSection';
import { FAQSection } from '../components/ui/faq-accordion';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Check,
  MapPin,
  Calendar,
  Clock,
  Home,
  ChevronRight,
  ArrowLeft,
  Star,
  Shield,
  Repeat,
  Sparkles,
  Users,
  Droplets,
  Timer,
  Info
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DAYS_OF_WEEK = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
];

const TIME_SLOTS = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM',
  '04:00 PM', '05:00 PM'
];

const DURATION_OPTIONS = [
  { value: 1, label: '1 hour', hours: 1 },
  { value: 1.5, label: '1.5 hours', hours: 1.5 },
  { value: 2, label: '2 hours', hours: 2, popular: true },
  { value: 3, label: '3 hours', hours: 3 },
];

const FREQUENCY_OPTIONS = [
  { value: 1, label: '1x/week', perMonth: 4 },
  { value: 2, label: '2x/week', perMonth: 8, popular: true },
  { value: 3, label: '3x/week', perMonth: 12 },
  { value: 4, label: '4x/week', perMonth: 16 },
  { value: 5, label: '5x/week', perMonth: 20 },
  { value: 6, label: '6x/week', perMonth: 24 },
];

const PLAN_DURATION_OPTIONS = [
  { value: 'monthly', label: 'Monthly', discount: 0 },
  { value: 'quarterly', label: 'Quarterly', discount: 0.05, badge: '5% off' },
];

const SubscriptionCheckoutPage = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [plan, setPlan] = useState(null);
  const [services, setServices] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Configuration state
  const [selectedService, setSelectedService] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [duration, setDuration] = useState(2);
  const [frequency, setFrequency] = useState(2);
  const [withMaterials, setWithMaterials] = useState(true);
  const [planDuration, setPlanDuration] = useState('monthly');
  const [preferredDays, setPreferredDays] = useState([0, 3]);
  const [preferredTime, setPreferredTime] = useState('09:00 AM');
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(2);
  const [propertySize, setPropertySize] = useState(1500);

  useEffect(() => {
    fetchData();
  }, [planId]);

  const fetchData = async () => {
    try {
      const [planRes, servicesRes, addressesRes] = await Promise.all([
        axios.get(`${API}/subscriptions/plans/${planId}`),
        axios.get(`${API}/services`),
        axios.get(`${API}/users/me/addresses`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setPlan(planRes.data);
      setServices(servicesRes.data);
      setAddresses(addressesRes.data);
      if (addressesRes.data.length > 0) {
        setSelectedAddress(addressesRes.data[0]);
      }
      if (servicesRes.data.length > 0) {
        setSelectedService(servicesRes.data[0]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  };

  // Live pricing calculation
  const pricing = useMemo(() => {
    if (!plan) return null;

    const baseHourlyRate = 35; // AED per hour
    const materialsFee = withMaterials ? 10 : 0; // per visit
    const freqOption = FREQUENCY_OPTIONS.find(f => f.value === frequency);
    const visitsPerMonth = freqOption?.perMonth || 8;
    const durationDiscount = duration >= 2 ? 0.05 : 0;
    const frequencyDiscount = frequency >= 3 ? 0.10 : frequency >= 2 ? 0.05 : 0;
    const planDiscount = PLAN_DURATION_OPTIONS.find(p => p.value === planDuration)?.discount || 0;

    const pricePerVisit = (baseHourlyRate * duration + materialsFee) * (1 - durationDiscount) * (1 - frequencyDiscount);
    const monthlyPrice = pricePerVisit * visitsPerMonth * (1 - planDiscount);
    const originalPrice = (baseHourlyRate * duration + materialsFee) * visitsPerMonth;
    const savings = originalPrice - monthlyPrice;
    const savingsPercent = (savings / originalPrice) * 100;

    return {
      pricePerVisit: pricePerVisit.toFixed(0),
      monthlyPrice: monthlyPrice.toFixed(0),
      originalPrice: originalPrice.toFixed(0),
      savings: savings.toFixed(0),
      savingsPercent: savingsPercent.toFixed(0),
      visitsPerMonth
    };
  }, [plan, duration, frequency, withMaterials, planDuration]);

  const toggleDay = (day) => {
    setPreferredDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const handleSubmit = async () => {
    if (!selectedAddress) {
      toast.error('Please select an address');
      return;
    }
    if (!selectedService) {
      toast.error('Please select a service');
      return;
    }
    if (preferredDays.length === 0) {
      toast.error('Please select at least one preferred day');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(
        `${API}/subscriptions/`,
        {
          plan_id: parseInt(planId),
          address_id: selectedAddress.id,
          service_id: selectedService.id,
          preferred_days: preferredDays,
          preferred_time_slot: preferredTime,
          property_size_sqft: propertySize,
          bedrooms: bedrooms,
          bathrooms: bathrooms
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Subscription created successfully!');
      navigate(`/subscriptions/${response.data.id}`);
    } catch (error) {
      console.error('Error creating subscription:', error);
      toast.error(error.response?.data?.detail || 'Failed to create subscription');
    } finally {
      setSubmitting(false);
    }
  };

  const subscriptionFaqs = [
    {
      question: 'How does the subscription work?',
      answer: 'Your subscription includes a set number of cleaning visits per month. You can schedule them at your convenience based on your preferred days and times. Unused visits roll over to the next month (up to the plan limit).'
    },
    {
      question: 'Can I change my cleaner?',
      answer: 'Yes! You can request a different cleaner at any time through your dashboard. We\'ll assign a new cleaner for your next visit.'
    },
    {
      question: 'What if I need to skip a week?',
      answer: 'No problem! You can pause individual visits or your entire subscription at any time. Paused visits don\'t count against your monthly allocation.'
    },
    {
      question: 'How do I cancel my subscription?',
      answer: 'You can cancel anytime from your dashboard. Your subscription will remain active until the end of your current billing cycle, and you can use any remaining visits.'
    },
    {
      question: 'Are cleaning materials included?',
      answer: 'You can choose whether to include materials. If selected, our cleaners bring eco-friendly, professional-grade products. Otherwise, they\'ll use your supplies.'
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <div className="pt-32 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-900"></div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <div className="pt-32 text-center">
          <p className="text-stone-600">Plan not found</p>
          <Button onClick={() => navigate('/subscriptions')} className="mt-4">
            View All Plans
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />

      {/* Service Hero Block */}
      <section className="pt-24 pb-6 bg-gradient-to-b from-emerald-50 to-stone-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <button
            onClick={() => navigate('/subscriptions')}
            className="flex items-center text-stone-600 hover:text-green-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Plans
          </button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                  Bestseller
                </span>
                <span className="px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-sm">
                  {plan.visits_per_month} visits/month
                </span>
              </div>
              <h1 className="font-heading text-3xl md:text-4xl font-bold text-green-900 mb-2">
                {plan.name}
              </h1>
              <p className="text-stone-600">{plan.description}</p>
            </div>

            {/* Rating & Stats */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  <span className="text-xl font-bold text-green-900">4.9</span>
                </div>
                <p className="text-xs text-stone-500">1,247 reviews</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-green-900">5K+</p>
                <p className="text-xs text-stone-500">Active subscribers</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <TrustSection variant="inline" />

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Configuration Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Duration Selection */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Timer className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-green-900">Cleaning Duration</h3>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDuration(opt.value)}
                    className={`relative p-4 rounded-xl border-2 text-center transition-all ${
                      duration === opt.value
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    {opt.popular && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                        Popular
                      </span>
                    )}
                    <p className="font-bold text-green-900">{opt.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Materials Selection */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Droplets className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-green-900">Cleaning Materials</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setWithMaterials(true)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    withMaterials
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <p className="font-semibold text-green-900 mb-1">With Materials</p>
                  <p className="text-sm text-stone-500">We bring eco-friendly products</p>
                  <p className="text-sm font-medium text-emerald-600 mt-2">+AED 10/visit</p>
                </button>
                <button
                  onClick={() => setWithMaterials(false)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    !withMaterials
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <p className="font-semibold text-green-900 mb-1">Without Materials</p>
                  <p className="text-sm text-stone-500">Use your own supplies</p>
                  <p className="text-sm font-medium text-stone-600 mt-2">No extra cost</p>
                </button>
              </div>
            </div>

            {/* Frequency Selection */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Repeat className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold text-green-900">Visits Per Week</h3>
                </div>
                <span className="text-sm text-stone-500">
                  {pricing?.visitsPerMonth} visits/month
                </span>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFrequency(opt.value)}
                    className={`relative p-3 rounded-xl border-2 text-center transition-all ${
                      frequency === opt.value
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    {opt.popular && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                        Popular
                      </span>
                    )}
                    <p className="font-bold text-green-900">{opt.label}</p>
                    <p className="text-xs text-stone-500">{opt.perMonth}/mo</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Plan Duration */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-green-900">Billing Cycle</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {PLAN_DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPlanDuration(opt.value)}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                      planDuration === opt.value
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    {opt.badge && (
                      <span className="absolute top-2 right-2 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                        {opt.badge}
                      </span>
                    )}
                    <p className="font-semibold text-green-900">{opt.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Address Selection */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-green-900">Service Address</h3>
              </div>
              {addresses.length === 0 ? (
                <div className="text-center py-6 bg-stone-50 rounded-lg">
                  <MapPin className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-stone-600 mb-3">No addresses found</p>
                  <Button variant="outline" onClick={() => navigate('/profile')}>
                    Add Address
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3">
                  {addresses.map((address) => (
                    <button
                      key={address.id}
                      onClick={() => setSelectedAddress(address)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        selectedAddress?.id === address.id
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Home className="w-5 h-5 text-stone-400 mt-0.5" />
                        <div>
                          <p className="font-medium text-green-900">{address.label}</p>
                          <p className="text-sm text-stone-500">
                            {address.street_address}, {address.city}
                          </p>
                        </div>
                        {selectedAddress?.id === address.id && (
                          <Check className="w-5 h-5 text-emerald-500 ml-auto" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Schedule Preferences */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-green-900">Preferred Schedule</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Preferred Days
                  </label>
                  <div className="flex gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        onClick={() => toggleDay(day.value)}
                        className={`w-12 h-12 rounded-full font-medium transition-all ${
                          preferredDays.includes(day.value)
                            ? 'bg-emerald-500 text-white'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Preferred Time
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setPreferredTime(slot)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          preferredTime === slot
                            ? 'bg-emerald-500 text-white'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Summary - Sticky Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-24">
              <h3 className="font-bold text-green-900 text-xl mb-4">Your Subscription</h3>

              {/* Plan Details */}
              <div className="space-y-3 pb-4 border-b border-stone-200">
                <div className="flex justify-between">
                  <span className="text-stone-600">Plan</span>
                  <span className="font-medium text-green-900">{plan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Duration</span>
                  <span className="font-medium text-green-900">{duration} hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Frequency</span>
                  <span className="font-medium text-green-900">{frequency}x/week</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Materials</span>
                  <span className="font-medium text-green-900">
                    {withMaterials ? 'Included' : 'Not included'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Visits/month</span>
                  <span className="font-medium text-green-900">{pricing?.visitsPerMonth}</span>
                </div>
              </div>

              {/* Pricing */}
              {pricing && (
                <div className="py-4 border-b border-stone-200">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-stone-600">Price per visit</span>
                    <span className="font-bold text-green-900">AED {pricing.pricePerVisit}</span>
                  </div>

                  <div className="bg-emerald-50 rounded-xl p-4 mb-3">
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium text-emerald-800">Monthly Total</span>
                      <div className="text-right">
                        <span className="text-3xl font-bold text-emerald-700">
                          AED {pricing.monthlyPrice}
                        </span>
                        <p className="text-sm text-stone-500 line-through">
                          AED {pricing.originalPrice}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Savings Highlight */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-lime-100 rounded-lg">
                    <Sparkles className="w-4 h-4 text-lime-600" />
                    <span className="text-sm font-medium text-lime-800">
                      You save AED {pricing.savings} ({pricing.savingsPercent}% off)
                    </span>
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="pt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !selectedAddress || preferredDays.length === 0}
                  className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-lg rounded-full"
                >
                  {submitting ? 'Creating...' : 'Subscribe Now'}
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
                <p className="text-xs text-center text-stone-500 mt-3">
                  Cancel anytime. No hidden fees.
                </p>
              </div>

              {/* Trust Indicators */}
              <div className="mt-6 pt-4 border-t border-stone-200 space-y-2">
                <div className="flex items-center gap-2 text-sm text-stone-600">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  Satisfaction guaranteed
                </div>
                <div className="flex items-center gap-2 text-sm text-stone-600">
                  <Users className="w-4 h-4 text-emerald-500" />
                  Vetted, insured cleaners
                </div>
                <div className="flex items-center gap-2 text-sm text-stone-600">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  Flexible scheduling
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <FAQSection
        title="Subscription FAQs"
        faqs={subscriptionFaqs}
      />

      {/* Reviews Section */}
      <ReviewsSection title="What Subscribers Say" showBreakdown={true} />

      {/* Sticky Checkout Bar - Mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-4 lg:hidden z-50">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-stone-500">Monthly total</p>
            <p className="text-2xl font-bold text-green-900">
              AED {pricing?.monthlyPrice || '—'}
            </p>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedAddress}
            className="bg-emerald-500 hover:bg-emerald-600 rounded-full px-8 h-12"
          >
            {submitting ? 'Creating...' : 'Subscribe'}
          </Button>
        </div>
      </div>

      {/* Bottom padding for mobile sticky bar */}
      <div className="h-24 lg:hidden" />
    </div>
  );
};

export default SubscriptionCheckoutPage;
