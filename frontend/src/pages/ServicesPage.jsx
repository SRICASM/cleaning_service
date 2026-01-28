import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import axios from 'axios';
import {
  Sparkles,
  SprayCan,
  Home,
  Building,
  Hammer,
  Sofa,
  ArrowRight,
  Check
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const iconMap = {
  Sparkles: Sparkles,
  SprayCan: SprayCan,
  Home: Home,
  Building: Building,
  Hammer: Hammer,
  Sofa: Sofa,
};

const ServicesPage = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await axios.get(`${API}/services`);
        setServices(response.data);
      } catch (error) {
        // Services will remain empty on error
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  const categories = [
    { id: 'all', name: 'All Services' },
    { id: 'residential', name: 'Residential' },
    { id: 'commercial', name: 'Commercial' },
    { id: 'specialty', name: 'Specialty' },
  ];

  const filteredServices = activeCategory === 'all'
    ? services
    : services.filter(s => s.category === activeCategory);

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-green-50 to-stone-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <span className="text-lime-600 font-medium uppercase tracking-wide text-sm">Our Services</span>
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-green-900 mt-3 mb-6">
            Professional Cleaning Services
          </h1>
          <p className="text-stone-600 text-lg max-w-2xl mx-auto">
            From regular home maintenance to specialized commercial cleaning, we deliver exceptional results every time.
          </p>
        </div>
      </section>

      {/* Category Filter */}
      <section className="py-8 bg-white border-b border-stone-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-6 py-2.5 rounded-full font-medium transition-all ${activeCategory === cat.id
                    ? 'bg-green-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                data-testid={`filter-${cat.id}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-3xl p-8 animate-pulse">
                  <div className="w-14 h-14 rounded-2xl bg-stone-200 mb-6" />
                  <div className="h-6 bg-stone-200 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-stone-100 rounded w-full mb-2" />
                  <div className="h-4 bg-stone-100 rounded w-5/6" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredServices.map((service) => {
                const IconComponent = iconMap[service.icon] || Sparkles;
                return (
                  <div
                    key={service.id}
                    className="group bg-white rounded-3xl p-8 border border-stone-100 shadow-soft hover:shadow-lg transition-all duration-300"
                    data-testid={`service-card-${service.id}`}
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-lime-100 flex items-center justify-center group-hover:bg-lime-500 transition-colors">
                        <IconComponent className="w-7 h-7 text-lime-600 group-hover:text-white transition-colors" />
                      </div>
                      <span className="px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-xs font-medium capitalize">
                        {service.category_name || service.category || 'General'}
                      </span>
                    </div>

                    <h3 className="font-heading text-2xl font-semibold text-green-900 mb-3">
                      {service.name}
                    </h3>
                    <p className="text-stone-600 mb-6 line-clamp-3">
                      {service.description || service.short_description || 'Professional cleaning service'}
                    </p>

                    <div className="space-y-2 mb-6">
                      {(service.features || []).slice(0, 3).map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-stone-600">
                          <Check className="w-4 h-4 text-lime-500" />
                          {feature}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-end justify-between pt-6 border-t border-stone-100">
                      <div>
                        <p className="text-sm text-stone-500">Starting from</p>
                        <p className="font-heading text-3xl font-bold text-lime-600">
                          ${service.base_price}
                        </p>
                      </div>
                      <Link to={`/booking?service=${service.id}`}>
                        <Button
                          className="bg-green-900 hover:bg-green-800 text-white rounded-full"
                          data-testid={`book-${service.id}`}
                        >
                          Book Now
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-green-900">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-white mb-6">
            Can't Find What You Need?
          </h2>
          <p className="text-green-100/80 text-lg mb-8">
            Contact us for custom cleaning solutions tailored to your specific requirements.
          </p>
          <Link to="/contact">
            <Button
              size="lg"
              className="bg-lime-500 hover:bg-lime-600 text-white rounded-full px-10"
              data-testid="services-contact"
            >
              Get Custom Quote
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ServicesPage;
