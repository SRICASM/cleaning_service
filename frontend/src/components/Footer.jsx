import { Link } from 'react-router-dom';
import { Sparkles, Phone, Mail, MapPin, Facebook, Instagram, Twitter } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-green-900 text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-xl bg-lime-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="font-heading font-bold text-xl">BrightHome</span>
            </Link>
            <p className="text-green-100/80 mb-6">
              Professional cleaning services that bring sparkle to your space. Trusted by thousands of happy customers.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center hover:bg-lime-500 transition-colors" data-testid="footer-facebook">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center hover:bg-lime-500 transition-colors" data-testid="footer-instagram">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center hover:bg-lime-500 transition-colors" data-testid="footer-twitter">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-6">Services</h3>
            <ul className="space-y-3">
              <li><Link to="/services" className="text-green-100/80 hover:text-lime-400 transition-colors">Standard Cleaning</Link></li>
              <li><Link to="/services" className="text-green-100/80 hover:text-lime-400 transition-colors">Deep Cleaning</Link></li>
              <li><Link to="/services" className="text-green-100/80 hover:text-lime-400 transition-colors">Move In/Out</Link></li>
              <li><Link to="/services" className="text-green-100/80 hover:text-lime-400 transition-colors">Office Cleaning</Link></li>
              <li><Link to="/services" className="text-green-100/80 hover:text-lime-400 transition-colors">Post-Construction</Link></li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-6">Quick Links</h3>
            <ul className="space-y-3">
              <li><Link to="/about" className="text-green-100/80 hover:text-lime-400 transition-colors">About Us</Link></li>
              <li><Link to="/services" className="text-green-100/80 hover:text-lime-400 transition-colors">Our Services</Link></li>
              <li><Link to="/booking" className="text-green-100/80 hover:text-lime-400 transition-colors">Book Now</Link></li>
              <li><Link to="/contact" className="text-green-100/80 hover:text-lime-400 transition-colors">Contact</Link></li>
              <li><Link to="/login" className="text-green-100/80 hover:text-lime-400 transition-colors">My Account</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-6">Contact Us</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-lime-400 mt-0.5 flex-shrink-0" />
                <span className="text-green-100/80">123 Clean Street, Suite 100<br />San Francisco, CA 94102</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-lime-400 flex-shrink-0" />
                <a href="tel:+14155551234" className="text-green-100/80 hover:text-lime-400 transition-colors">(415) 555-1234</a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-lime-400 flex-shrink-0" />
                <a href="mailto:hello@brighthome.com" className="text-green-100/80 hover:text-lime-400 transition-colors">hello@brighthome.com</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-green-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-green-100/60 text-sm">
              © {new Date().getFullYear()} BrightHome Cleaning. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <a href="#" className="text-green-100/60 hover:text-lime-400 transition-colors">Privacy Policy</a>
              <a href="#" className="text-green-100/60 hover:text-lime-400 transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
