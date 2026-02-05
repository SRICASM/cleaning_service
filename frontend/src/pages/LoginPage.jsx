import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PasswordInput } from '../components/ui/password-input';
import { toast } from 'sonner';
import { getErrorMessage } from '../utils/errorUtils';
import { Sparkles, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userData = await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Invalid credentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-20">
        <div className="max-w-md w-full mx-auto">
          <Link to="/" className="flex items-center gap-2 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-green-950 flex items-center justify-center mb-4 shadow-lg shadow-green-900/20">
              <Sparkles className="w-6 h-6 text-lime-400" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-green-950">Welcome Back</h1>
            <p className="text-stone-500 mt-2">Sign in to manage your bookings</p>
          </Link> {/* Closing Link tag for the logo/title block */}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-stone-600">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-12 rounded-xl border-stone-200 focus:border-green-600 focus:ring-green-600"
                required
                data-testid="login-email"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="password" className="text-stone-600">Password</Label>
                <Link to="/forgot-password" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl border-stone-200 focus:border-green-600 focus:ring-green-600 pr-10"
                  required
                  data-testid="login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-green-950 hover:bg-green-900 text-white rounded-xl h-12 font-medium transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-green-900/10"
              data-testid="login-submit"
            >
              {loading ? 'Signing in...' : 'Sign In'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <p className="mt-8 text-center text-stone-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-green-900 font-medium hover:underline" data-testid="login-register-link">
              Create one
            </Link>
          </p>

          {/* Cleaner login disabled - enable when needed
          <div className="mt-4 text-center">
            <Link to="/cleaner/login" className="text-sm text-stone-500 hover:text-green-900 transition-colors">
              Are you a cleaner? Login here
            </Link>
          </div>
          */}

          {/* Demo credentials */}
          <div className="mt-8 p-4 bg-lime-50 rounded-xl border border-lime-200">
            <p className="text-sm font-medium text-lime-800 mb-2">Demo Admin Credentials:</p>
            <p className="text-sm text-lime-700">Email: admin@cleanupcrew.com</p>
            <p className="text-sm text-lime-700">Password: admin123</p>
          </div>
        </div>
      </div>

      {/* Right Side - Image/Decoration */}
      <div className="hidden lg:block relative flex-1 bg-green-950 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1581578731117-104f2a417954?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-40 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-t from-green-950 via-green-950/50 to-transparent" />

        <div className="relative h-full flex flex-col justify-end p-12 text-white">
          <div className="mb-6">
            <div className="w-12 h-12 bg-lime-400 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-green-950" />
            </div>
            <blockquote className="font-heading text-3xl font-bold leading-tight mb-4">
              "The most reliable cleaning service I've ever experienced. Absolutely spotless results every time."
            </blockquote>
            <cite className="not-italic text-lg text-green-100 font-medium block">
              — Sarah Chen, Happy Customer
            </cite>
          </div>
        </div>
      </div>
    </div >
  );
};

export default LoginPage;
