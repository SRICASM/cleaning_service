import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Check,
  Star,
  Calendar,
  Sparkles,
  Clock,
  Shield,
  ArrowRight
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SubscriptionPlansPage = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API}/subscriptions/plans`);
      setPlans(response.data);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan) => {
    if (!user) {
      toast.info('Please login to subscribe');
      navigate('/login', { state: { from: '/subscriptions' } });
      return;
    }

    // Add subscription plan to cart as a service item
    addItem({
      serviceId: `subscription-${plan.id}`,
      serviceName: `${plan.name} Subscription`,
      serviceDescription: plan.description,
      basePrice: parseFloat(plan.price_per_visit || plan.monthly_price / plan.visits_per_month),
      price: parseFloat(plan.price_per_visit || plan.monthly_price / plan.visits_per_month),
      type: 'subscription',
      subscriptionPlan: {
        id: plan.id,
        name: plan.name,
        visitsPerMonth: plan.visits_per_month,
        monthlyPrice: parseFloat(plan.monthly_price),
        discountPercentage: plan.discount_percentage
      },
      forceNew: true
    });

    toast.success(`${plan.name} added! Now schedule your ${plan.visits_per_month} visits.`);

    // Small delay to ensure cart state is updated before navigation
    setTimeout(() => {
      navigate('/booking', {
        state: {
          defaultMode: 'multiple',
          subscriptionPlan: plan
        }
      });
    }, 150);
  };

  const benefits = [
    { icon: Calendar, title: 'Flexible Scheduling', description: 'Choose your preferred days and times' },
    { icon: Sparkles, title: 'Priority Booking', description: 'Get priority access to time slots' },
    { icon: Clock, title: 'Rollover Visits', description: 'Unused visits roll over to next month' },
    { icon: Shield, title: 'Preferred Cleaner', description: 'Same trusted cleaner every visit' },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-green-50 to-stone-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <span className="text-lime-600 font-medium uppercase tracking-wide text-sm">
            Subscription Plans
          </span>
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-green-900 mt-3 mb-6">
            Save More with Regular Cleaning
          </h1>
          <p className="text-stone-600 text-lg max-w-2xl mx-auto">
            Subscribe to our cleaning plans and enjoy consistent, professional cleaning at discounted rates.
            Cancel anytime with no hidden fees.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12 bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center p-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <benefit.icon className="w-6 h-6 text-green-700" />
                </div>
                <h3 className="font-semibold text-green-900 mb-1">{benefit.title}</h3>
                <p className="text-sm text-stone-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-900"></div>
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-stone-600">No subscription plans available at the moment.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all hover:shadow-lg ${plan.is_featured
                      ? 'border-lime-500 scale-105'
                      : 'border-stone-200 hover:border-green-300'
                    }`}
                >
                  {plan.is_featured && (
                    <div className="absolute top-0 right-0 bg-lime-500 text-white px-4 py-1 text-sm font-medium rounded-bl-lg">
                      <Star className="w-4 h-4 inline mr-1" />
                      Most Popular
                    </div>
                  )}

                  <div className="p-8">
                    <h3 className="text-2xl font-bold text-green-900 mb-2">{plan.name}</h3>
                    <p className="text-stone-600 mb-6">{plan.description}</p>

                    <div className="mb-6">
                      <span className="text-4xl font-bold text-green-900">
                        AED {parseFloat(plan.monthly_price).toFixed(0)}
                      </span>
                      <span className="text-stone-500">/month</span>
                      {plan.price_per_visit && (
                        <p className="text-sm text-lime-600 mt-1">
                          Only AED {parseFloat(plan.price_per_visit).toFixed(0)} per visit
                        </p>
                      )}
                    </div>

                    <div className="space-y-3 mb-8">
                      <div className="flex items-center text-stone-700">
                        <Check className="w-5 h-5 text-lime-500 mr-3 flex-shrink-0" />
                        <span><strong>{plan.visits_per_month}</strong> cleaning visits per month</span>
                      </div>
                      <div className="flex items-center text-stone-700">
                        <Check className="w-5 h-5 text-lime-500 mr-3 flex-shrink-0" />
                        <span>Up to <strong>{plan.max_rollover_visits}</strong> visits rollover</span>
                      </div>
                      {plan.discount_percentage && (
                        <div className="flex items-center text-stone-700">
                          <Check className="w-5 h-5 text-lime-500 mr-3 flex-shrink-0" />
                          <span><strong>{parseFloat(plan.discount_percentage).toFixed(0)}%</strong> savings vs one-time</span>
                        </div>
                      )}
                      {plan.features?.priority_booking && (
                        <div className="flex items-center text-stone-700">
                          <Check className="w-5 h-5 text-lime-500 mr-3 flex-shrink-0" />
                          <span>Priority booking access</span>
                        </div>
                      )}
                      {plan.features?.preferred_cleaner && (
                        <div className="flex items-center text-stone-700">
                          <Check className="w-5 h-5 text-lime-500 mr-3 flex-shrink-0" />
                          <span>Same preferred cleaner</span>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => handleSelectPlan(plan)}
                      className={`w-full ${plan.is_featured
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200'
                          : 'bg-green-950 hover:bg-green-900 text-white shadow-md'
                        }`}
                    >
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-green-900 text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="bg-stone-50 rounded-lg p-6">
              <h3 className="font-semibold text-green-900 mb-2">Can I cancel my subscription anytime?</h3>
              <p className="text-stone-600">Yes! You can cancel your subscription at any time. Your remaining visits will still be available until the end of your billing cycle.</p>
            </div>
            <div className="bg-stone-50 rounded-lg p-6">
              <h3 className="font-semibold text-green-900 mb-2">What happens to unused visits?</h3>
              <p className="text-stone-600">Unused visits roll over to the next month, up to the maximum rollover limit specified in your plan.</p>
            </div>
            <div className="bg-stone-50 rounded-lg p-6">
              <h3 className="font-semibold text-green-900 mb-2">Can I pause my subscription?</h3>
              <p className="text-stone-600">Yes, you can pause your subscription if you're going on vacation or need a break. Your visits will be preserved until you resume.</p>
            </div>
            <div className="bg-stone-50 rounded-lg p-6">
              <h3 className="font-semibold text-green-900 mb-2">Can I change my plan?</h3>
              <p className="text-stone-600">Absolutely! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default SubscriptionPlansPage;
