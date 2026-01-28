import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PasswordInput } from '../components/ui/password-input';
import { toast } from 'sonner';
import { getErrorMessage } from '../utils/errorUtils';
import { Sparkles, Mail, User, Phone, ArrowRight, MapPin, AlertCircle } from 'lucide-react';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Redirect if already logged in
  if (user) {
    navigate('/dashboard');
    return null;
  }

  const validateForm = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!address.trim()) {
      newErrors.address = 'Street address is required';
    }

    if (!city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!postalCode.trim()) {
      newErrors.postalCode = 'Postal code is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password, phone, address, city, postalCode);
      toast.success('Account created successfully!');
      navigate('/setup-property');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const InputError = ({ error }) => {
    if (!error) return null;
    return (
      <p className="flex items-center gap-1 text-red-600 text-sm mt-1 animate-fadeIn">
        <AlertCircle className="w-3 h-3" />
        {error}
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Left side - Image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <div className="absolute inset-0 bg-green-900">
          <img
            src="https://images.unsplash.com/photo-1660993431493-0ffd7635f700?w=1200&h=1600&fit=crop"
            alt="Cleaning supplies"
            className="w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 flex items-center justify-center p-12">
            <div className="text-center text-white">
              <h2 className="font-heading text-4xl font-bold mb-4">
                Join CleanUpCrew Today
              </h2>
              <p className="text-white/80 text-lg max-w-md">
                Create an account to book cleanings, track appointments, and enjoy exclusive member benefits.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-20">
        <div className="max-w-md w-full mx-auto">
          <Link to="/" className="flex items-center gap-2 mb-10">
            <div className="w-10 h-10 rounded-xl bg-green-900 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-lime-400" />
            </div>
            <span className="font-heading font-bold text-xl text-green-900">CleanUpCrew</span>
          </Link>

          <h1 className="font-heading text-3xl font-bold text-green-900 mb-2">
            Create your account
          </h1>
          <p className="text-stone-600 mb-8">
            Get started with your first booking in minutes.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <div className="relative mt-2">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors({ ...errors, name: '' });
                  }}
                  placeholder="John Doe"
                  className={`pl-10 ${errors.name ? 'border-red-500 focus:ring-red-500' : ''}`}
                  data-testid="register-name"
                />
              </div>
              <InputError error={errors.name} />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: '' });
                  }}
                  placeholder="you@example.com"
                  className={`pl-10 ${errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
                  data-testid="register-email"
                />
              </div>
              <InputError error={errors.email} />
            </div>

            <div>
              <Label htmlFor="phone">Phone (Optional)</Label>
              <div className="relative mt-2">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(415) 555-1234"
                  className="pl-10"
                  data-testid="register-phone"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="mt-2">
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: '' });
                  }}
                  placeholder="Create a strong password"
                  showStrength
                  showRequirements
                  data-testid="register-password"
                />
              </div>
              <InputError error={errors.password} />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="mt-2">
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
                  }}
                  placeholder="Confirm your password"
                  data-testid="register-confirm-password"
                />
              </div>
              <InputError error={errors.confirmPassword} />
              {confirmPassword && password && confirmPassword === password && (
                <p className="text-green-600 text-sm mt-1 flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-500 inline-flex items-center justify-center text-white text-xs">✓</span>
                  Passwords match
                </p>
              )}
            </div>

            {/* Address Section */}
            <div className="border-t border-stone-200 pt-5 mt-5">
              <p className="text-sm font-medium text-stone-700 mb-4">Your Address (for service location)</p>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="address">Street Address</Label>
                  <div className="relative mt-2">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <Input
                      id="address"
                      type="text"
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        if (errors.address) setErrors({ ...errors, address: '' });
                      }}
                      placeholder="123 Main Street, Apt 4B"
                      className={`pl-10 ${errors.address ? 'border-red-500 focus:ring-red-500' : ''}`}
                      data-testid="register-address"
                    />
                  </div>
                  <InputError error={errors.address} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      type="text"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (errors.city) setErrors({ ...errors, city: '' });
                      }}
                      placeholder="San Francisco"
                      className={`mt-2 ${errors.city ? 'border-red-500 focus:ring-red-500' : ''}`}
                      data-testid="register-city"
                    />
                    <InputError error={errors.city} />
                  </div>
                  <div>
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      type="text"
                      value={postalCode}
                      onChange={(e) => {
                        setPostalCode(e.target.value);
                        if (errors.postalCode) setErrors({ ...errors, postalCode: '' });
                      }}
                      placeholder="94102"
                      className={`mt-2 ${errors.postalCode ? 'border-red-500 focus:ring-red-500' : ''}`}
                      data-testid="register-postal"
                    />
                    <InputError error={errors.postalCode} />
                  </div>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-green-900 hover:bg-green-800 text-white rounded-full h-12 transition-all hover:scale-[1.02] active:scale-[0.98]"
              data-testid="register-submit"
            >
              {loading ? 'Creating account...' : 'Create Account'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <p className="mt-8 text-center text-stone-600">
            Already have an account?{' '}
            <Link to="/login" className="text-green-900 font-medium hover:underline" data-testid="register-login-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
