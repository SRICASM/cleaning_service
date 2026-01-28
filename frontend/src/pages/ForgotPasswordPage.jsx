import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { getErrorMessage } from '../utils/errorUtils';
import axios from 'axios';
import { Sparkles, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ForgotPasswordPage = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email) {
            toast.error('Please enter your email address');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API}/auth/forgot-password`, { email });
            setSent(true);
            toast.success('Reset link sent! Check your email.');
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to send reset link'));
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
                <div className="max-w-md w-full text-center">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h1 className="font-heading text-2xl font-bold text-green-900 mb-2">
                        Check Your Email
                    </h1>
                    <p className="text-stone-600 mb-6">
                        If an account exists for <strong>{email}</strong>, we've sent a password reset link to that email address.
                    </p>
                    <p className="text-stone-500 text-sm mb-6">
                        The link will expire in 1 hour.
                    </p>
                    <Link to="/login">
                        <Button variant="outline" className="rounded-full">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Login
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 mb-6">
                        <Sparkles className="w-8 h-8 text-green-900" />
                        <span className="font-heading font-bold text-2xl text-green-900">CleanUpCrew</span>
                    </Link>
                    <h1 className="font-heading text-3xl font-bold text-green-900 mb-2">
                        Forgot Password?
                    </h1>
                    <p className="text-stone-600">
                        Enter your email and we'll send you a reset link.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-stone-200 p-8 space-y-6">
                    <div>
                        <Label htmlFor="email">Email Address</Label>
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
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-green-900 hover:bg-green-800 text-white rounded-full h-12"
                    >
                        {loading ? 'Sending...' : 'Send Reset Link'}
                    </Button>

                    <div className="text-center">
                        <Link to="/login" className="text-sm text-green-700 hover:text-green-900">
                            <ArrowLeft className="w-4 h-4 inline mr-1" />
                            Back to Login
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
