import { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  MessageSquare
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/contact`, formData);
      toast.success('Message sent! We\'ll get back to you soon.');
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (error) {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const contactInfo = [
    {
      icon: Phone,
      title: 'Phone',
      details: '(415) 555-1234',
      subtext: 'Mon-Fri 8am-6pm'
    },
    {
      icon: Mail,
      title: 'Email',
      details: 'hello@cleanupcrew.com',
      subtext: 'We reply within 24 hours'
    },
    {
      icon: MapPin,
      title: 'Office',
      details: '123 Clean Street, Suite 100',
      subtext: 'San Francisco, CA 94102'
    },
    {
      icon: Clock,
      title: 'Hours',
      details: 'Mon-Sat: 7am - 8pm',
      subtext: 'Sunday: 9am - 5pm'
    },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-green-50 to-stone-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <span className="text-lime-600 font-medium uppercase tracking-wide text-sm">Contact Us</span>
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-green-900 mt-3 mb-6">
            Get in Touch
          </h1>
          <p className="text-stone-600 text-lg max-w-2xl mx-auto">
            Have questions or need a custom quote? We'd love to hear from you. Our team is here to help.
          </p>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {contactInfo.map((item, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 border border-stone-100 shadow-soft">
                <div className="w-12 h-12 rounded-xl bg-lime-100 flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-lime-600" />
                </div>
                <h3 className="font-heading font-semibold text-green-900 mb-1">{item.title}</h3>
                <p className="text-green-900 font-medium">{item.details}</p>
                <p className="text-stone-500 text-sm">{item.subtext}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* Form */}
            <div className="bg-white rounded-3xl p-8 lg:p-10 border border-stone-100 shadow-soft">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-lime-100 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-lime-600" />
                </div>
                <div>
                  <h2 className="font-heading text-2xl font-bold text-green-900">Send a Message</h2>
                  <p className="text-stone-600 text-sm">We'll get back to you within 24 hours</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="John Doe"
                      className="mt-2"
                      required
                      data-testid="contact-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      className="mt-2"
                      required
                      data-testid="contact-email"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="phone">Phone (Optional)</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="(415) 555-1234"
                      className="mt-2"
                      data-testid="contact-phone"
                    />
                  </div>
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      placeholder="How can we help?"
                      className="mt-2"
                      required
                      data-testid="contact-subject"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Tell us more about your inquiry..."
                    className="mt-2"
                    rows={5}
                    required
                    data-testid="contact-message"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-950 hover:bg-green-900 text-white rounded-xl h-12 shadow-md shadow-green-900/10"
                  data-testid="contact-submit"
                >
                  {loading ? 'Sending...' : 'Send Message'}
                  <Send className="w-4 h-4 ml-2" />
                </Button>
              </form>
            </div>

            {/* Map / Info */}
            <div>
              <div className="rounded-3xl overflow-hidden h-80 lg:h-full min-h-[400px] bg-stone-200">
                <iframe
                  title="Office Location"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3153.0977927595944!2d-122.41941692357636!3d37.77492967197701!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8085809c6c8f4459%3A0xb10ed6d9b5050fa5!2sSan%20Francisco%20City%20Hall!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus"
                  className="w-full h-full border-0"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Preview */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="font-heading text-3xl font-bold text-green-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-stone-600 mb-10">
            Quick answers to common questions about our services.
          </p>

          <div className="space-y-4 text-left">
            {[
              { q: 'How do I book a cleaning?', a: 'Simply click "Book Now" and follow our easy 4-step booking process. Select your service, enter property details, choose a date/time, and complete payment.' },
              { q: 'What if I\'m not satisfied?', a: 'We offer a 100% satisfaction guarantee. If you\'re not happy, we\'ll re-clean for free or provide a full refund.' },
              { q: 'Are your cleaners insured?', a: 'Yes! All our cleaning professionals are fully insured, background-checked, and professionally trained.' },
            ].map((faq, index) => (
              <div key={index} className="bg-stone-50 rounded-2xl p-6 border border-stone-100">
                <h3 className="font-heading font-semibold text-green-900 mb-2">{faq.q}</h3>
                <p className="text-stone-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ContactPage;
