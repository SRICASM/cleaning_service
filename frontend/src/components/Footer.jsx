import { Link } from 'react-router-dom';
import { Sparkles, Phone, Mail, MapPin, Facebook, Instagram, Twitter, ArrowRight } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gradient-to-b from-green-950 to-green-900 text-white relative overflow-hidden">
      {/* Subtle Pattern */}
      <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]" />
      {/* Decorative gradient orb */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-lime-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-3 mb-6 group">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center transition-all group-hover:bg-lime-500/20 group-hover:scale-105">
                <Sparkles className="w-6 h-6 text-lime-400" />
              </div>
              <span className="font-heading font-bold text-xl tracking-tight">CleanUpCrew</span>
            </Link>
            <p className="text-green-100/70 mb-6 leading-relaxed">
              Professional cleaning services that bring sparkle to your space. Trusted by thousands of happy customers.
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-lime-500 hover:border-lime-500 transition-all hover:scale-110" data-testid="footer-facebook">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-lime-500 hover:border-lime-500 transition-all hover:scale-110" data-testid="footer-instagram">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-lime-500 hover:border-lime-500 transition-all hover:scale-110" data-testid="footer-twitter">
                <Twitter className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-6 flex items-center gap-2">
              Services
              <span className="w-8 h-0.5 bg-gradient-to-r from-lime-400 to-transparent rounded-full" />
            </h3>
            <ul className="space-y-3">
              {['Standard Cleaning', 'Deep Cleaning', 'Move In/Out'].map((service) => (
                <li key={service}>
                  <Link to="/services" className="text-green-100/70 hover:text-lime-400 transition-colors flex items-center gap-2 group">
                    <ArrowRight className="w-3 h-3 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                    {service}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-6 flex items-center gap-2">
              Quick Links
              <span className="w-8 h-0.5 bg-gradient-to-r from-lime-400 to-transparent rounded-full" />
            </h3>
            <ul className="space-y-3">
              {[
                { name: 'About Us', to: '/about' },
                { name: 'Our Services', to: '/services' },
                { name: 'Book Now', to: '/booking' },
                { name: 'Contact', to: '/contact' },
                { name: 'My Account', to: '/login' }
              ].map((link) => (
                <li key={link.name}>
                  <Link to={link.to} className="text-green-100/70 hover:text-lime-400 transition-colors flex items-center gap-2 group">
                    <ArrowRight className="w-3 h-3 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-6 flex items-center gap-2">
              Contact Us
              <span className="w-8 h-0.5 bg-gradient-to-r from-lime-400 to-transparent rounded-full" />
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-lime-500/20 transition-colors">
                  <MapPin className="w-4 h-4 text-lime-400" />
                </div>
                <span className="text-green-100/70 text-sm leading-relaxed">123 Clean Street, Suite 100<br />San Francisco, CA 94102</span>
              </li>
              <li className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-lime-500/20 transition-colors">
                  <Phone className="w-4 h-4 text-lime-400" />
                </div>
                <a href="tel:+14155551234" className="text-green-100/70 hover:text-lime-400 transition-colors text-sm">(415) 555-1234</a>
              </li>
              <li className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-lime-500/20 transition-colors">
                  <Mail className="w-4 h-4 text-lime-400" />
                </div>
                <a href="mailto:hello@cleanupcrew.com" className="text-green-100/70 hover:text-lime-400 transition-colors text-sm">hello@cleanupcrew.com</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-12 mb-8 h-px bg-gradient-to-r from-transparent via-green-800 to-transparent" />

        {/* Bottom */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-green-100/50 text-sm">
            © {new Date().getFullYear()} CleanUpCrew Cleaning. All rights reserved.
          </p>
          <div className="flex gap-8 text-sm">
            <a href="#" className="text-green-100/50 hover:text-lime-400 transition-colors">Privacy Policy</a>
            <a href="#" className="text-green-100/50 hover:text-lime-400 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
