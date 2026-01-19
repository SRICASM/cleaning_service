import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import axios from 'axios';
import { 
  Sparkles, 
  CheckCircle, 
  Star, 
  ArrowRight, 
  Shield, 
  Clock, 
  ThumbsUp,
  Home,
  Building,
  SprayCan,
  Calendar,
  Users,
  Award
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const iconMap = {
  Sparkles: Sparkles,
  SprayCan: SprayCan,
  Home: Home,
  Building: Building,
};

const HomePage = () => {
  const [services, setServices] = useState([]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await axios.get(`${API}/services`);
        setServices(response.data.slice(0, 4));
      } catch (error) {
        console.error('Failed to fetch services:', error);
      }
    };
    fetchServices();
  }, []);

  const stats = [
    { value: '10K+', label: 'Happy Customers', icon: Users },
    { value: '15+', label: 'Years Experience', icon: Award },
    { value: '50K+', label: 'Homes Cleaned', icon: Home },
    { value: '4.9', label: 'Customer Rating', icon: Star },
  ];

  const features = [
    {
      icon: Shield,
      title: 'Vetted Professionals',
      description: 'Every cleaner is background-checked, trained, and insured for your peace of mind.'
    },
    {
      icon: Clock,
      title: 'Flexible Scheduling',
      description: 'Book your preferred time slot. We work around your schedule, not the other way around.'
    },
    {
      icon: ThumbsUp,
      title: 'Satisfaction Guaranteed',
      description: "Not happy? We'll re-clean for free. Your satisfaction is our top priority."
    },
  ];

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Homeowner',
      content: "BrightHome has transformed my weekly routine. The team is professional, thorough, and I love coming home to a spotless house!",
      rating: 5,
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop'
    },
    {
      name: 'Michael Chen',
      role: 'Office Manager',
      content: "We switched to BrightHome for our office cleaning and the difference is remarkable. Reliable, consistent, and great value.",
      rating: 5,
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop'
    },
    {
      name: 'Emily Rodriguez',
      role: 'Property Manager',
      content: "Their move-out cleaning service is exceptional. Every unit is left spotless and ready for new tenants.",
      rating: 5,
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop'
    },
  ];

  const howItWorks = [
    { step: 1, title: 'Choose Your Service', description: 'Select from our range of cleaning services tailored to your needs.' },
    { step: 2, title: 'Book Online', description: 'Pick your preferred date, time, and add any extras you need.' },
    { step: 3, title: 'We Clean', description: 'Our vetted professionals arrive on time and get to work.' },
    { step: 4, title: 'Enjoy', description: 'Relax in your fresh, sparkling clean space!' },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-32 hero-gradient overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fadeInUp">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-lime-100 text-lime-700 text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                Trusted by 10,000+ customers
              </span>
              <h1 className="font-heading text-5xl md:text-6xl lg:text-7xl font-bold text-green-900 leading-tight mb-6">
                A Cleaner Home,<br />
                <span className="text-lime-600">A Happier Life</span>
              </h1>
              <p className="text-lg text-stone-600 mb-8 max-w-lg">
                Professional cleaning services that fit your schedule and exceed your expectations. Book in 60 seconds.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/booking">
                  <Button 
                    size="lg" 
                    className="bg-green-900 hover:bg-green-800 text-white rounded-full px-8 h-14 text-lg"
                    data-testid="hero-book-now"
                  >
                    Book Your Clean
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link to="/services">
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="rounded-full px-8 h-14 text-lg border-2"
                    data-testid="hero-view-services"
                  >
                    View Services
                  </Button>
                </Link>
              </div>
              
              {/* Trust badges */}
              <div className="flex items-center gap-6 mt-10">
                <div className="flex -space-x-3">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="w-10 h-10 rounded-full bg-stone-300 border-2 border-white" />
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1 text-amber-500">
                    {[1,2,3,4,5].map((i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-sm text-stone-600">4.9/5 from 2,000+ reviews</p>
                </div>
              </div>
            </div>
            
            <div className="relative animate-fadeInUp stagger-2">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img 
                  src="https://images.unsplash.com/photo-1758548157747-285c7012db5b?w=800&h=600&fit=crop"
                  alt="Clean bright living room"
                  className="w-full h-auto object-cover"
                />
              </div>
              {/* Floating card */}
              <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl p-4 shadow-xl animate-slideIn stagger-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-lime-100 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-lime-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-900">100% Satisfaction</p>
                    <p className="text-sm text-stone-500">Guaranteed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-y border-stone-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-lime-100 flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="w-7 h-7 text-lime-600" />
                </div>
                <p className="font-heading text-3xl lg:text-4xl font-bold text-green-900">{stat.value}</p>
                <p className="text-stone-600 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-lime-600 font-medium uppercase tracking-wide text-sm">Our Services</span>
            <h2 className="font-heading text-4xl lg:text-5xl font-bold text-green-900 mt-3 mb-4">
              Cleaning Solutions for Every Need
            </h2>
            <p className="text-stone-600 max-w-2xl mx-auto">
              From regular maintenance to deep cleans, we've got you covered with professional services tailored to your space.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => {
              const IconComponent = iconMap[service.icon] || Sparkles;
              return (
                <div 
                  key={service.id} 
                  className="service-card group"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="w-14 h-14 rounded-2xl bg-lime-100 flex items-center justify-center mb-6 group-hover:bg-lime-500 group-hover:text-white transition-colors">
                    <IconComponent className="w-7 h-7 text-lime-600 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="font-heading text-xl font-semibold text-green-900 mb-2">
                    {service.name}
                  </h3>
                  <p className="text-stone-600 text-sm mb-4">
                    {service.short_description}
                  </p>
                  <p className="font-heading text-2xl font-bold text-lime-600">
                    From ${service.base_price}
                  </p>
                </div>
              );
            })}
          </div>
          
          <div className="text-center mt-12">
            <Link to="/services">
              <Button 
                variant="outline" 
                size="lg" 
                className="rounded-full px-8 border-2 border-green-900 text-green-900 hover:bg-green-900 hover:text-white"
                data-testid="services-view-all"
              >
                View All Services
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-lime-600 font-medium uppercase tracking-wide text-sm">How It Works</span>
            <h2 className="font-heading text-4xl lg:text-5xl font-bold text-green-900 mt-3 mb-4">
              Book in 4 Simple Steps
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((item, index) => (
              <div key={index} className="text-center relative">
                <div className="w-16 h-16 rounded-full bg-green-900 text-white flex items-center justify-center mx-auto mb-6 font-heading text-2xl font-bold">
                  {item.step}
                </div>
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-stone-200" />
                )}
                <h3 className="font-heading text-xl font-semibold text-green-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-stone-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-lime-600 font-medium uppercase tracking-wide text-sm">Why Choose Us</span>
              <h2 className="font-heading text-4xl lg:text-5xl font-bold text-green-900 mt-3 mb-8">
                Quality You Can Trust
              </h2>
              
              <div className="space-y-8">
                {features.map((feature, index) => (
                  <div key={index} className="flex gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-lime-100 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-7 h-7 text-lime-600" />
                    </div>
                    <div>
                      <h3 className="font-heading text-xl font-semibold text-green-900 mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-stone-600">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <div className="rounded-3xl overflow-hidden shadow-xl">
                <img 
                  src="https://images.unsplash.com/photo-1713863574460-ccd3bbb47f1e?w=600&h=700&fit=crop"
                  alt="Professional cleaner"
                  className="w-full h-auto object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -right-6 bg-lime-500 text-white rounded-2xl p-6 shadow-xl">
                <p className="font-heading text-4xl font-bold">15+</p>
                <p className="text-lime-100">Years of Excellence</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 lg:py-32 bg-green-900">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-lime-400 font-medium uppercase tracking-wide text-sm">Testimonials</span>
            <h2 className="font-heading text-4xl lg:text-5xl font-bold text-white mt-3 mb-4">
              What Our Customers Say
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div 
                key={index} 
                className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/10"
              >
                <div className="flex gap-1 text-amber-400 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-current" />
                  ))}
                </div>
                <p className="text-white/90 mb-6 leading-relaxed">
                  "{testimonial.content}"
                </p>
                <div className="flex items-center gap-3">
                  <img 
                    src={testimonial.image} 
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold text-white">{testimonial.name}</p>
                    <p className="text-white/60 text-sm">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="font-heading text-4xl lg:text-5xl font-bold text-green-900 mb-6">
            Ready for a Spotless Space?
          </h2>
          <p className="text-stone-600 text-lg mb-10 max-w-2xl mx-auto">
            Book your first cleaning today and experience the BrightHome difference. Professional, reliable, and satisfaction guaranteed.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/booking">
              <Button 
                size="lg" 
                className="bg-lime-500 hover:bg-lime-600 text-white rounded-full px-10 h-14 text-lg"
                data-testid="cta-book-now"
              >
                <Calendar className="w-5 h-5 mr-2" />
                Book Now
              </Button>
            </Link>
            <Link to="/contact">
              <Button 
                size="lg" 
                variant="outline" 
                className="rounded-full px-10 h-14 text-lg border-2"
                data-testid="cta-contact"
              >
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;
