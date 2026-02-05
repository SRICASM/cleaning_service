import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { getErrorMessage } from '../utils/errorUtils';
import axios from 'axios';
import {
    Sparkles,
    Home,
    Building,
    Building2,
    Store,
    Plus,
    Minus,
    ArrowRight
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PropertySetupPage = () => {
    const navigate = useNavigate();
    const { user, token, setUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [propertyType, setPropertyType] = useState('');
    const [bedrooms, setBedrooms] = useState(2);
    const [bathrooms, setBathrooms] = useState(1);

    const propertyTypes = [
        { id: 'apartment', name: 'Apartment', icon: Building },
        { id: 'house', name: 'House', icon: Home },
        { id: 'office', name: 'Office', icon: Building2 },
        { id: 'commercial', name: 'Commercial', icon: Store },
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!propertyType) {
            toast.error('Please select a property type');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.put(`${API}/users/profile`, {
                property_type: propertyType,
                bedrooms: bedrooms,
                bathrooms: bathrooms
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Update user in context with new property data
            if (setUser && response.data) {
                setUser(response.data);
            }

            toast.success('Property details saved!');
            navigate('/dashboard');
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to save property details'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6 py-12">
            <div className="max-w-xl w-full">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="bg-white rounded-3xl shadow-xl overflow-hidden p-8">
                        <div className="w-16 h-16 rounded-2xl bg-green-950 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-900/20">
                            <Home className="w-8 h-8 text-lime-400" />
                        </div>
                        <h1 className="font-heading text-3xl font-bold text-green-900 mb-2">
                            Welcome, {user?.name?.split(' ')[0]}! 👋
                        </h1>
                        <p className="text-stone-600">
                            Tell us about your property so we can provide accurate quotes.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-stone-200 p-8">
                    {/* Property Type */}
                    <div className="mb-8">
                        <Label className="text-base font-medium mb-4 block">Property Type</Label>
                        <div className="grid grid-cols-2 gap-4">
                            {propertyTypes.map((type) => (
                                <div
                                    key={type.id}
                                    onClick={() => setPropertyType(type.id)}
                                    className={`cursor-pointer p-6 rounded-xl border-2 text-center transition-all ${propertyType === type.id
                                        ? 'border-green-900 bg-green-50'
                                        : 'border-stone-200 hover:border-green-900/30'
                                        }`}
                                >
                                    <type.icon className={`w-8 h-8 mx-auto mb-2 ${propertyType === type.id ? 'text-green-900' : 'text-stone-400'
                                        }`} />
                                    <span className={`font-medium ${propertyType === type.id ? 'text-green-900' : 'text-stone-600'
                                        }`}>{type.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bedrooms & Bathrooms */}
                    <div className="grid grid-cols-2 gap-6 mb-8">
                        <div>
                            <Label htmlFor="bedrooms">Bedrooms</Label>
                            <div className="flex items-center gap-3 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setBedrooms(Math.max(0, bedrooms - 1))}
                                    className="w-10 h-10 rounded-full border border-stone-300 flex items-center justify-center hover:bg-stone-100"
                                >
                                    <Minus className="w-4 h-4" />
                                </button>
                                <Input
                                    id="bedrooms"
                                    type="number"
                                    value={bedrooms}
                                    onChange={(e) => setBedrooms(parseInt(e.target.value) || 0)}
                                    className="text-center"
                                />
                                <button
                                    type="button"
                                    onClick={() => setBedrooms(bedrooms + 1)}
                                    className="w-10 h-10 rounded-full border border-stone-300 flex items-center justify-center hover:bg-stone-100"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="bathrooms">Bathrooms</Label>
                            <div className="flex items-center gap-3 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setBathrooms(Math.max(1, bathrooms - 1))}
                                    className="w-10 h-10 rounded-full border border-stone-300 flex items-center justify-center hover:bg-stone-100"
                                >
                                    <Minus className="w-4 h-4" />
                                </button>
                                <Input
                                    id="bathrooms"
                                    type="number"
                                    value={bathrooms}
                                    onChange={(e) => setBathrooms(parseInt(e.target.value) || 1)}
                                    className="text-center"
                                />
                                <button
                                    type="button"
                                    onClick={() => setBathrooms(bathrooms + 1)}
                                    className="w-10 h-10 rounded-full border border-stone-300 flex items-center justify-center hover:bg-stone-100"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-green-950 hover:bg-green-900 text-white rounded-xl h-12 shadow-md"
                    >
                        {loading ? 'Saving...' : 'Continue to Dashboard'}
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </form>

                <p className="text-center text-stone-500 text-sm mt-6">
                    You can update these details later in your profile settings.
                </p>
            </div>
        </div>
    );
};

export default PropertySetupPage;
