import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { getErrorMessage } from '../utils/errorUtils';
import axios from 'axios';
import { Sparkles, Lock, ArrowRight, CheckCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ResetPasswordPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!token) {
            toast.error('Invalid reset link');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            await axios.post(`${API}/auth/reset-password`, {
                token,
                new_password: password
            });
            setSuccess(true);
            toast.success('Password reset successful!');
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to reset password'));
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
                <div className="max-w-md w-full text-center">
                    <h1 className="font-heading text-2xl font-bold text-red-600 mb-4">
                        Invalid Reset Link
                    </h1>
                    <p className="text-stone-600 mb-6">
                        This password reset link is invalid or has expired.
                    </p>
                    <Link to="/forgot-password">
                        <Button className="bg-green-900 hover:bg-green-800 text-white rounded-full">
                            Request New Reset Link
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
                <div className="max-w-md w-full text-center">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h1 className="font-heading text-2xl font-bold text-green-900 mb-2">
                        Password Reset!
                    </h1>
                    <p className="text-stone-600 mb-6">
                        Your password has been successfully reset. You can now log in with your new password.
                    </p>
                    <Link to="/login">
                        <Button className="bg-green-900 hover:bg-green-800 text-white rounded-full">
                            Go to Login
                            <ArrowRight className="w-4 h-4 ml-2" />
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
                        Reset Your Password
                    </h1>
                    <p className="text-stone-600">
                        Enter your new password below.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-stone-200 p-8 space-y-6">
                    <div>
                        <Label htmlFor="password">New Password</Label>
                        <div className="relative mt-2">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="pl-10"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <div className="relative mt-2">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
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
                        {loading ? 'Resetting...' : 'Reset Password'}
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
