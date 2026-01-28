import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PasswordInput } from '../components/ui/password-input';
import { toast } from 'sonner';
import { getErrorMessage } from '../utils/errorUtils';
import { Sparkles, Mail, ArrowRight } from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  if (user) {
    navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userData = await login(email, password);
      toast.success('Welcome back!');
      navigate(userData.role === 'admin' ? '/admin' : '/dashboard');
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
            <div className="w-10 h-10 rounded-xl bg-green-900 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-lime-400" />
            </div>
            <span className="font-heading font-bold text-xl text-green-900">CleanUpCrew</span>
          </Link>

          <h1 className="font-heading text-3xl font-bold text-green-900 mb-2">
            Welcome back
          </h1>
          <p className="text-stone-600 mb-8">
            Sign in to manage your bookings and account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10"
                  required
                  data-testid="login-email"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="mt-2">
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  data-testid="login-password"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-green-700 hover:text-green-900">
                Forgot your password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-green-900 hover:bg-green-800 text-white rounded-full h-12 transition-all hover:scale-[1.02] active:scale-[0.98]"
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

          {/* Demo credentials */}
          <div className="mt-8 p-4 bg-lime-50 rounded-xl border border-lime-200">
            <p className="text-sm font-medium text-lime-800 mb-2">Demo Admin Credentials:</p>
            <p className="text-sm text-lime-700">Email: admin@cleanupcrew.com</p>
            <p className="text-sm text-lime-700">Password: admin123</p>
          </div>
        </div>
      </div>

      {/* Right side - Image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <div className="absolute inset-0 bg-green-900">
          <img
            src="https://images.unsplash.com/photo-1765948079484-3bb1af6e5268?w=1200&h=1600&fit=crop"
            alt="Clean home"
            className="w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 flex items-center justify-center p-12">
            <div className="text-center text-white">
              <h2 className="font-heading text-4xl font-bold mb-4">
                A Cleaner Space Awaits
              </h2>
              <p className="text-white/80 text-lg max-w-md">
                Book professional cleaning services in minutes and enjoy a spotless home.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
