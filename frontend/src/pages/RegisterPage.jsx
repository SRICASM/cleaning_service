import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
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
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: ''
  });
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
    return <Navigate to="/" replace />;
  }

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
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
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();
      await register(fullName, email, password, phone, address, city, postalCode);
      toast.success('Account created successfully!');
      navigate('/');
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
      {/* Left Side - Image */}
      <div className="hidden lg:block relative flex-1 bg-green-950 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-40 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-t from-green-950 via-green-950/50 to-transparent" />

        <div className="relative h-full flex flex-col justify-end p-12 text-white">
          <div className="mb-6">
            <div className="w-12 h-12 bg-lime-400 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-green-950" />
            </div>
            <h2 className="font-heading text-4xl font-bold leading-tight mb-4">
              Join our community of clean spaces.
            </h2>
            <ul className="space-y-3 text-green-100/90 text-lg">
              <li className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-lime-400"></span>Trusted Professionals</li>
              <li className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-lime-400"></span>Flexible Scheduling</li>
              <li className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-lime-400"></span>Satisfaction Guaranteed</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-20">
        <div className="max-w-md w-full mx-auto">
          <Link to="/" className="flex items-center gap-2 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-green-950 flex items-center justify-center mb-4 shadow-lg shadow-green-900/20">
              <Sparkles className="w-6 h-6 text-lime-400" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-green-950">Create Account</h1>
            <p className="text-stone-500 mt-2">Join us for a cleaner, happier home</p>
          </Link>

          <h1 className="font-heading text-3xl font-bold text-green-950 mb-2">
            Create your account
          </h1>
          <p className="text-stone-600 mb-8">
            Get started with your first booking in minutes.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="text-stone-600">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => {
                    setFormData({ ...formData, firstName: e.target.value });
                    if (errors.firstName) setErrors({ ...errors, firstName: '' });
                  }}
                  className="mt-1.5 h-12 rounded-xl border-stone-200 focus:border-green-600 focus:ring-green-600"
                  required
                />
                <InputError error={errors.firstName} />
              </div>
              <div>
                <Label htmlFor="lastName" className="text-stone-600">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => {
                    setFormData({ ...formData, lastName: e.target.value });
                    if (errors.lastName) setErrors({ ...errors, lastName: '' });
                  }}
                  className="mt-1.5 h-12 rounded-xl border-stone-200 focus:border-green-600 focus:ring-green-600"
                  required
                />
                <InputError error={errors.lastName} />
              </div>
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
              className="w-full bg-green-950 hover:bg-green-900 text-white rounded-xl h-12 font-medium transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-green-900/10"
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
