import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import { Sparkles, ArrowRight, Lock, Phone, RefreshCw, Eye, EyeOff } from 'lucide-react';
import './CleanerLoginPage.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CleanerLoginPage = () => {
    const navigate = useNavigate();
    const { otpLogin } = useAuth(); // We reuse otpLogin as it handles the token response format

    // State
    const [formData, setFormData] = useState({
        identifier: '', // Phone or Email (UI label says Mobile Number for now as per request)
        password: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Handle inputs
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePhoneChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');

        // Handle common paste cases
        if (value.startsWith('971')) {
            value = value.substring(3);
        }

        // Remove leading zero if present (common mistake: 050...)
        if (value.startsWith('0')) {
            value = value.substring(1);
        }

        // Limit to 9 digits (UAE mobile number length excluding country code)
        value = value.slice(0, 9);

        setFormData({ ...formData, identifier: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.identifier || !formData.password) {
            toast.error('Please enter your credentials');
            return;
        }

        setLoading(true);
        try {
            // Assume phone login for now based on user request "JUST THE PHONE NUMBER"
            // If we want email support, we'd detect if input has '@'

            const payload = {
                phone_number: `+971${formData.identifier}`,
                password: formData.password
            };

            const res = await axios.post(`${API}/auth/employee/login`, payload);

            // Use auth context to login
            otpLogin(res.data);

            toast.success(`Welcome back, ${res.data.user.full_name}!`);
            navigate('/cleaner/dashboard');

        } catch (err) {
            const msg = err.response?.data?.detail || 'Login failed';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="cleaner-login-page">
            <div className="login-container">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-lime-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-lime-200">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-green-900">Cleaner Partner</h1>
                    <p className="text-stone-500">Login to your account</p>
                </div>

                {/* Login Form */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Phone Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-stone-700">Mobile Number</label>
                            <div className="relative">
                                <div className="absolute left-0 top-0 bottom-0 w-16 bg-stone-50 border-r border-stone-200 rounded-l-lg flex items-center justify-center text-stone-500 font-medium z-10">
                                    +971
                                </div>
                                <Input
                                    type="tel"
                                    inputMode="numeric"
                                    name="identifier"
                                    value={formData.identifier}
                                    onChange={handlePhoneChange}
                                    className="pl-20 h-12 text-lg font-medium tracking-wide"
                                    placeholder="50 123 4567"
                                    autoFocus
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-stone-700">Password</label>
                            <div className="relative">
                                <div className="absolute left-3 top-0 bottom-0 flex items-center pointer-events-none">
                                    <Lock className="w-5 h-5 text-stone-400" />
                                </div>
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="pl-10 pr-10 h-12 text-lg"
                                    placeholder="Enter your password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-0 bottom-0 flex items-center text-stone-400 hover:text-stone-600"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 bg-lime-600 hover:bg-lime-700 text-lg"
                            disabled={loading}
                        >
                            {loading ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Login <ArrowRight className="w-5 h-5 ml-2" />
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="mt-4 text-center">
                        <p className="text-xs text-stone-400">
                            Default password provided by Admin in SMS.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <div className="space-y-2">
                        <Link to="/login" className="block text-sm text-stone-500 hover:text-green-900 transition-colors">
                            Are you a customer? Login here
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CleanerLoginPage;
