import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import axios from 'axios';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Menu, X, User, LogOut, LayoutDashboard, Calendar, Sparkles, Settings, Wallet, Gift, ChevronDown, MapPin } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Navbar = ({ transparent = false }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userAddress, setUserAddress] = useState('');
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll effect for transparency
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch user address if logged in
  useEffect(() => {
    const fetchUserAddress = async () => {
      if (!user || !token) return;
      try {
        const response = await axios.get(`${API}/users/me/addresses`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const addresses = response.data;
        const defaultAddr = addresses.find(a => a.is_default) || addresses[0];
        if (defaultAddr) {
          const parts = [defaultAddr.building_name, defaultAddr.area].filter(Boolean);
          setUserAddress(parts.join(', ') || defaultAddr.street || 'Address set');
        } else {
          setUserAddress('Add Address');
        }
      } catch (error) {
        // Silent fail or default
        setUserAddress('Select Address');
      }
    };
    fetchUserAddress();
  }, [user, token]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navLinks = [];

  const isActive = (href) => location.pathname === href;

  // Determine if we should show white background or transparent
  // If transparent prop is true: transparent at top, white on scroll.
  // If transparent prop is false: always white.
  const isTransparent = transparent && !scrolled && !mobileMenuOpen;

  const textColorClass = isTransparent ? 'text-white' : 'text-stone-900';
  const subTextColorClass = isTransparent ? 'text-white/80' : 'text-stone-500';
  const bgColorClass = isTransparent ? 'bg-transparent border-transparent' : 'bg-white/95 backdrop-blur-xl border-stone-200/50 shadow-sm';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${bgColorClass}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* LEFT: Location Selector (Mobile/Desktop) or Logo if not logged in */}
          {user ? (
            <button
              onClick={() => navigate('/profile', { state: { openAddresses: true } })}
              className="flex items-center gap-2 group text-left"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isTransparent ? 'bg-white/20' : 'bg-stone-100'}`}>
                <MapPin className={`w-4 h-4 ${isTransparent ? 'text-white' : 'text-emerald-600'}`} />
              </div>
              <div>
                <div className={`flex items-center gap-1 font-semibold text-sm md:text-base ${textColorClass}`}>
                  <span className="hidden md:inline">Current Location</span>
                  <span className="md:hidden">Home</span>
                  <ChevronDown className="w-4 h-4" />
                </div>
                <p className={`text-xs truncate max-w-[150px] md:max-w-[250px] ${subTextColorClass}`}>
                  {userAddress || 'Select Address'}
                </p>
              </div>
            </button>
          ) : (
            <Link to="/" className="flex items-center gap-2" data-testid="nav-logo">
              <div className="w-10 h-10 rounded-xl bg-green-900 flex items-center justify-center shadow-lg shadow-green-900/20">
                <Sparkles className="w-5 h-5 text-lime-400" />
              </div>
              <span className={`font-heading font-bold text-xl hidden md:inline-block ${isTransparent ? 'text-white' : 'text-green-900'}`}>
                CleanUpCrew
              </span>
            </Link>
          )}

          {/* CENTER: Desktop Nav Links (Hidden if Logo is taking space? No, usually fine) */}
          <div className="hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className={`text-sm font-medium hover:opacity-100 transition-opacity ${isActive(link.href) ? 'opacity-100' : 'opacity-70'} ${textColorClass}`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* RIGHT: Actions */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <button
                  onClick={() => navigate('/wallet')}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${isTransparent ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white shadow-sm border border-stone-100 text-pink-500 hover:shadow-md'}`}
                  title="Wallet"
                >
                  <Wallet className="w-5 h-5" />
                </button>

                <button
                  onClick={() => navigate('/referrals')}
                  className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${isTransparent ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white shadow-sm border border-stone-100 text-green-500 hover:shadow-md'}`}
                  title="Referrals"
                >
                  <Gift className="w-5 h-5" />
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                    $50
                  </span>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className={`rounded-full gap-2 px-2 ml-2 ${isTransparent ? 'hover:bg-white/20 text-white' : 'hover:bg-stone-100'}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold shadow-md">
                        {user.name.charAt(0)}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-xl border-stone-100">
                    <div className="px-2 py-2 mb-2 bg-stone-50 rounded-xl">
                      <p className="font-bold text-stone-900">{user.name}</p>
                      <p className="text-xs text-stone-500 truncate">{user.email}</p>
                    </div>
                    <DropdownMenuItem onClick={() => navigate('/dashboard')} className="rounded-lg cursor-pointer">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/profile')} className="rounded-lg cursor-pointer">
                      <Settings className="w-4 h-4 mr-2" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/booking')} className="rounded-lg cursor-pointer font-semibold text-emerald-600">
                      <Calendar className="w-4 h-4 mr-2" />
                      Book Service
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="rounded-lg cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50">
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className={`font-medium ${isTransparent ? 'text-white hover:bg-white/20' : ''}`}>
                    Sign In
                  </Button>
                </Link>
                <Link to="/booking">
                  <Button
                    className={`rounded-full px-6 shadow-lg shadow-green-900/20 ${isTransparent ? 'bg-white text-green-900 hover:bg-green-50' : 'bg-green-900 hover:bg-green-800 text-white'}`}
                  >
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className={`md:hidden p-2 rounded-lg ${isTransparent ? 'text-white hover:bg-white/20' : 'text-stone-900 hover:bg-stone-100'}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-stone-200 animate-fadeIn h-screen absolute top-16 left-0 right-0 p-4">
          {user && (
            <div className="mb-6 p-4 bg-stone-50 rounded-2xl flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xl">
                {user.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-lg text-stone-900">{user.name}</p>
                <p className="text-sm text-stone-500">{user.email}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className="block py-3 px-4 rounded-xl font-medium text-stone-600 hover:bg-stone-50 hover:text-green-900 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}

            <div className="my-4 border-t border-stone-100" />

            {user ? (
              <div className="grid grid-cols-2 gap-3">
                <Link to="/wallet" onClick={() => setMobileMenuOpen(false)} className="col-span-1 p-3 bg-stone-50 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-pink-50 transition-colors group">
                  <Wallet className="w-6 h-6 text-pink-500 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium text-stone-700">Wallet</span>
                </Link>
                <Link to="/referrals" onClick={() => setMobileMenuOpen(false)} className="col-span-1 p-3 bg-stone-50 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-green-50 transition-colors group">
                  <Gift className="w-6 h-6 text-green-500 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-medium text-stone-700">Refer & Earn</span>
                </Link>

                <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="col-span-2">
                  <Button variant="outline" className="w-full justify-start h-12 text-base">
                    <LayoutDashboard className="w-5 h-5 mr-3" />
                    Dashboard
                  </Button>
                </Link>
                <Link to="/booking" onClick={() => setMobileMenuOpen(false)} className="col-span-2">
                  <Button className="w-full bg-lime-500 hover:bg-lime-600 h-12 text-base text-lg font-bold shadow-lg shadow-lime-200">
                    <Calendar className="w-5 h-5 mr-3" />
                    Book Now
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  className="col-span-2 w-full justify-start text-red-600 h-12"
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  Logout
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full h-12 text-base">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-green-900 hover:bg-green-800 h-12 text-base">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
