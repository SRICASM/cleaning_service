import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import {
  Sparkles,
  Shield,
  Heart,
  Award,
  Users,
  Target,
  Leaf
} from 'lucide-react';

const AboutPage = () => {
  const values = [
    {
      icon: Shield,
      title: 'Trust & Reliability',
      description: 'Every cleaner is background-checked and trained to our high standards.'
    },
    {
      icon: Heart,
      title: 'Customer First',
      description: 'Your satisfaction is our priority. We listen, adapt, and deliver.'
    },
    {
      icon: Leaf,
      title: 'Eco-Friendly',
      description: 'We use environmentally responsible products that are safe for your family.'
    },
    {
      icon: Award,
      title: 'Excellence',
      description: 'We strive for perfection in every clean, every time.'
    },
  ];

  const team = [
    {
      name: 'Sarah Mitchell',
      role: 'Founder & CEO',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop',
      bio: 'Started CleanUpCrew with a vision to revolutionize the cleaning industry.'
    },
    {
      name: 'David Chen',
      role: 'Operations Director',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop',
      bio: 'Ensures every cleaning meets our quality standards.'
    },
    {
      name: 'Maria Garcia',
      role: 'Customer Success',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop',
      bio: 'Dedicated to making every customer experience exceptional.'
    },
  ];

  const stats = [
    { value: '2010', label: 'Founded' },
    { value: '10K+', label: 'Happy Customers' },
    { value: '150+', label: 'Team Members' },
    { value: '50K+', label: 'Cleans Completed' },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-green-50 to-stone-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-lime-600 font-medium uppercase tracking-wide text-sm">About Us</span>
              <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-green-900 mt-3 mb-6">
                Bringing Sparkle to Every Space Since 2010
              </h1>
              <p className="text-stone-600 text-lg leading-relaxed">
                CleanUpCrew was founded with a simple mission: to provide exceptional cleaning services that give people back their most precious resource—time. What started as a small team of dedicated cleaners has grown into a trusted name in professional cleaning services.
              </p>
            </div>
            <div className="relative">
              <div className="rounded-3xl overflow-hidden shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1713863574460-ccd3bbb47f1e?w=600&h=500&fit=crop"
                  alt="Our team at work"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-green-950 text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="font-heading text-4xl lg:text-5xl font-bold text-lime-400">{stat.value}</p>
                <p className="text-green-100 mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="rounded-3xl overflow-hidden shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1660993431493-0ffd7635f700?w=600&h=500&fit=crop"
                  alt="Professional cleaning"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-lime-100 flex items-center justify-center">
                  <Target className="w-6 h-6 text-lime-600" />
                </div>
                <span className="text-lime-600 font-medium uppercase tracking-wide text-sm">Our Mission</span>
              </div>
              <h2 className="font-heading text-3xl lg:text-4xl font-bold text-green-900 mb-6">
                Creating Clean Spaces, Happy Lives
              </h2>
              <p className="text-stone-600 text-lg leading-relaxed mb-6">
                We believe everyone deserves a clean, healthy environment. Our mission is to deliver exceptional cleaning services that exceed expectations while treating our team members with respect and providing them with fair wages and growth opportunities.
              </p>
              <p className="text-stone-600 text-lg leading-relaxed">
                Every clean we complete is an opportunity to make someone's day a little brighter. That's why we approach each job with care, attention to detail, and a genuine desire to help.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-lime-600 font-medium uppercase tracking-wide text-sm">Our Values</span>
            <h2 className="font-heading text-3xl lg:text-4xl font-bold text-green-900 mt-3 mb-4">
              What We Stand For
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <div key={index} className="feature-card text-center">
                <div className="w-14 h-14 rounded-2xl bg-lime-100 flex items-center justify-center mx-auto mb-6">
                  <value.icon className="w-7 h-7 text-lime-600" />
                </div>
                <h3 className="font-heading text-xl font-semibold text-green-900 mb-3">
                  {value.title}
                </h3>
                <p className="text-stone-600">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-lime-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-lime-600" />
              </div>
            </div>
            <span className="text-lime-600 font-medium uppercase tracking-wide text-sm">Our Team</span>
            <h2 className="font-heading text-3xl lg:text-4xl font-bold text-green-900 mt-3 mb-4">
              Meet the People Behind CleanUpCrew
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {team.map((member, index) => (
              <div key={index} className="bg-white rounded-3xl p-8 border border-stone-100 shadow-soft text-center">
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-32 h-32 rounded-full mx-auto mb-6 object-cover"
                />
                <h3 className="font-heading text-xl font-semibold text-green-900 mb-1">
                  {member.name}
                </h3>
                <p className="text-lime-600 font-medium mb-4">{member.role}</p>
                <p className="text-stone-600">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-green-950 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <Sparkles className="w-12 h-12 text-lime-400 mx-auto mb-6" />
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-white mb-6">
            Ready to Experience the Difference?
          </h2>
          <p className="text-green-100/80 text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied customers who trust CleanUpCrew for their cleaning needs.
          </p>
          <Link to="/booking">
            <Button
              size="lg"
              className="bg-lime-500 hover:bg-lime-600 text-white px-10 py-4 rounded-full font-medium text-lg transition-all hover:scale-105"
              data-testid="about-cta"
            >
              Book Your First Clean
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AboutPage;
