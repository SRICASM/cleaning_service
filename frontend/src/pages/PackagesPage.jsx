import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import TrustSection from '../components/sections/TrustSection';
import { Button } from '../components/ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Check,
  Star,
  ArrowRight,
  BadgePercent,
  Clock,
  Sparkles,
  Gift,
  Shield,
  ThumbsUp,
  CreditCard,
  ChevronRight,
  Info,
  Zap,
  Tag
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PackagesPage = () => {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();
  const [selectedVisits, setSelectedVisits] = useState(4);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await axios.get(`${API}/services`);
      setServices(response.data);
    } catch (error) {
      console.log('Error fetching services');
    } finally {
      setLoading(false);
    }
  };

  const visitTabs = [
    { visits: 2, label: '2 Visits', savings: '10%' },
    { visits: 4, label: '4 Visits', savings: '15%', popular: true },
    { visits: 6, label: '6 Visits', savings: '20%' },
    { visits: 12, label: '12 Visits', savings: '25%', bestValue: true },
  ];

  // Package configurations based on visit count
  const getPackages = (visits) => {
    const basePrice = 150; // Base price per visit
    const discountMap = { 2: 0.10, 4: 0.15, 6: 0.20, 12: 0.25 };
    const discount = discountMap[visits] || 0.10;

    return [
      {
        id: `regular-${visits}`,
        name: 'Regular Cleaning',
        description: 'Standard home cleaning for everyday freshness',
        rating: 4.8,
        reviewCount: 1247,
        basePrice: basePrice * visits,
        discountedPrice: basePrice * visits * (1 - discount),
        pricePerVisit: basePrice * (1 - discount),
        savings: basePrice * visits * discount,
        validity: visits <= 4 ? '3 months' : visits <= 6 ? '4 months' : '6 months',
        features: ['Living areas', 'Bedrooms', 'Bathrooms', 'Kitchen'],
        icon: Sparkles,
        popular: visits === 4
      },
      {
        id: `deep-${visits}`,
        name: 'Deep Cleaning',
        description: 'Thorough cleaning including hard-to-reach areas',
        rating: 4.9,
        reviewCount: 892,
        basePrice: 250 * visits,
        discountedPrice: 250 * visits * (1 - discount),
        pricePerVisit: 250 * (1 - discount),
        savings: 250 * visits * discount,
        validity: visits <= 4 ? '4 months' : visits <= 6 ? '5 months' : '8 months',
        features: ['All regular areas', 'Inside cabinets', 'Appliance cleaning', 'Wall washing'],
        icon: Zap,
        bestValue: visits >= 6
      },
      {
        id: `move-${visits}`,
        name: 'Move In/Out',
        description: 'Complete cleaning for property transitions',
        rating: 4.7,
        reviewCount: 456,
        basePrice: 300 * visits,
        discountedPrice: 300 * visits * (1 - discount),
        pricePerVisit: 300 * (1 - discount),
        savings: 300 * visits * discount,
        validity: visits <= 4 ? '6 months' : '12 months',
        features: ['Full property clean', 'Window cleaning', 'Carpet cleaning', 'Fixture polishing'],
        icon: Gift
      }
    ];
  };

  const packages = getPackages(selectedVisits);

  const howItWorks = [
    { step: 1, title: 'Choose Package', description: 'Select visits and service type' },
    { step: 2, title: 'Add to Cart', description: 'Review savings and checkout' },
    { step: 3, title: 'Book Anytime', description: 'Use visits within validity period' },
  ];

  const offers = [
    { icon: Gift, title: 'First Package Bonus', description: 'Extra 30 min free on first visit', code: 'FIRST30' },
    { icon: CreditCard, title: '10% Cashback', description: 'Pay with select cards', code: 'CARD10' },
    { icon: Tag, title: 'Refer & Earn', description: 'Get AED 50 for each referral', code: 'REFER50' },
  ];

  const handleAddPackage = (pkg) => {
    if (!user) {
      toast.info('Please login to purchase packages');
      navigate('/login', { state: { from: '/packages' } });
      return;
    }

    addItem({
      serviceId: pkg.id,
      name: `${pkg.name} - ${selectedVisits} Visits`,
      type: 'package',
      price: pkg.discountedPrice,
      originalPrice: pkg.basePrice,
      options: {
        visits: selectedVisits,
        validity: pkg.validity
      }
    });

    toast.success('Package added to cart!');
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-24 pb-8 bg-gradient-to-b from-amber-50 to-stone-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mb-4">
              <BadgePercent className="w-4 h-4" />
              Save up to 25% with Packages
            </div>
            <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-green-900 mb-4">
              Multi-Visit Cleaning Packages
            </h1>
            <div className="flex items-center justify-center gap-4 text-stone-600">
              <div className="flex items-center gap-1">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <span className="font-medium">4.8</span>
                <span className="text-stone-400">(2,500+ reviews)</span>
              </div>
              <span className="text-stone-300">|</span>
              <span>10K+ packages sold</span>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
            <h3 className="font-semibold text-green-900 mb-4 text-center">How It Works</h3>
            <div className="grid grid-cols-3 gap-4">
              {howItWorks.map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="font-bold text-emerald-600">{item.step}</span>
                  </div>
                  <p className="font-medium text-green-900 text-sm">{item.title}</p>
                  <p className="text-xs text-stone-500">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Visit Selector Tabs - Horizontal Scroll */}
      <section className="sticky top-16 z-40 bg-white border-b border-stone-200 py-4">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide justify-center">
            {visitTabs.map((tab) => (
              <button
                key={tab.visits}
                onClick={() => setSelectedVisits(tab.visits)}
                className={`relative flex flex-col items-center px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${selectedVisits === tab.visits
                    ? 'bg-green-950 text-white shadow-lg'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
              >
                {tab.bestValue && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Best Value
                  </span>
                )}
                {tab.popular && !tab.bestValue && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Popular
                  </span>
                )}
                <span className="text-lg font-bold">{tab.label}</span>
                <span className={`text-xs ${selectedVisits === tab.visits ? 'text-lime-300' : 'text-emerald-600'}`}>
                  Save {tab.savings}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Package Cards */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative bg-white rounded-2xl border-2 overflow-hidden transition-all hover:shadow-xl ${pkg.popular
                    ? 'border-emerald-500 shadow-lg'
                    : pkg.bestValue
                      ? 'border-amber-500 shadow-lg'
                      : 'border-stone-200'
                  }`}
              >
                {/* Badge */}
                {(pkg.popular || pkg.bestValue) && (
                  <div className={`absolute top-0 right-0 px-4 py-1 text-white text-sm font-medium rounded-bl-xl ${pkg.bestValue ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}>
                    {pkg.bestValue ? 'Best Value' : 'Popular'}
                  </div>
                )}

                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${pkg.bestValue ? 'bg-amber-100' : 'bg-emerald-100'
                      }`}>
                      <pkg.icon className={`w-6 h-6 ${pkg.bestValue ? 'text-amber-600' : 'text-emerald-600'}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl text-green-900">{pkg.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-0.5">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          <span className="text-sm font-medium">{pkg.rating}</span>
                        </div>
                        <span className="text-xs text-stone-400">({pkg.reviewCount} reviews)</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-stone-600 text-sm mb-4">{pkg.description}</p>

                  {/* Pricing */}
                  <div className="bg-stone-50 rounded-xl p-4 mb-4">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-3xl font-bold text-green-900">
                        AED {pkg.discountedPrice.toFixed(0)}
                      </span>
                      <span className="text-lg text-stone-400 line-through">
                        AED {pkg.basePrice.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-stone-500">
                        AED {pkg.pricePerVisit.toFixed(0)} per visit
                      </span>
                      <span className="text-emerald-600 font-medium">
                        Save AED {pkg.savings.toFixed(0)}
                      </span>
                    </div>
                  </div>

                  {/* Validity */}
                  <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-50 rounded-lg">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="text-sm text-amber-800">Valid for {pkg.validity}</span>
                  </div>

                  {/* Features */}
                  <div className="space-y-2 mb-6">
                    {pkg.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-stone-600">
                        <Check className="w-4 h-4 text-emerald-500" />
                        {feature}
                      </div>
                    ))}
                  </div>

                  {/* CTA Buttons */}
                  <div className="space-y-2">
                    <Button
                      onClick={() => handleAddPackage(pkg)}
                      className={`w-full h-12 rounded-full ${pkg.popular || pkg.bestValue
                          ? 'bg-emerald-500 hover:bg-emerald-600'
                          : 'bg-green-950 hover:bg-green-900'
                        } text-white transition-colors flex items-center justify-center gap-2 group-hover:gap-3`}
                    >
                      Add to Cart
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <button className="w-full text-center text-sm text-stone-500 hover:text-green-900 py-2">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section - Compact */}
      <TrustSection variant="compact" />

      {/* Offers Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <h2 className="text-2xl font-bold text-green-900 mb-6 text-center">Exclusive Offers</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {offers.map((offer, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100"
              >
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <offer.icon className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-green-900">{offer.title}</p>
                  <p className="text-sm text-stone-500">{offer.description}</p>
                </div>
                <span className="px-3 py-1 bg-white rounded-full text-xs font-mono font-bold text-emerald-600 border border-emerald-200">
                  {offer.code}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subscription Upsell */}
      <section className="py-12 bg-gradient-to-br from-green-900 to-emerald-800">
        <div className="max-w-4xl mx-auto px-4 lg:px-8 text-center">
          <h2 className="font-heading text-2xl lg:text-3xl font-bold text-white mb-4">
            Need Regular Cleaning?
          </h2>
          <p className="text-emerald-100 mb-6">
            Monthly subscriptions offer even better value with up to 30% savings and flexible scheduling.
          </p>
          <Button
            onClick={() => navigate('/subscriptions')}
            className="bg-lime-500 hover:bg-lime-600 text-white rounded-full px-8 h-12"
          >
            View Subscription Plans
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      <Footer />

      {/* Bottom padding for sticky cart */}
      <div className="h-20" />
    </div>
  );
};

export default PackagesPage;
