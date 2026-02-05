import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { MapPin, Plus, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AddressSelector = ({ selectedAddress, onSelectAddress }) => {
    const { user, getAuthHeaders } = useAuth();
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAddresses();
    }, [user]);

    const fetchAddresses = async () => {
        try {
            const response = await axios.get(`${API}/users/me/addresses`, {
                headers: getAuthHeaders()
            });
            setAddresses(response.data);

            // Auto-select default if none selected
            if (!selectedAddress && response.data.length > 0) {
                const defaultAddr = response.data.find(a => a.is_default) || response.data[0];
                onSelectAddress(defaultAddr);
            }
        } catch (error) {
            console.error('Failed to load addresses', error);
            // toast.error('Failed to load saved addresses');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-green-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    Location
                </h3>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    onClick={() => window.location.href = '/profile'} // Simple redirect for now
                >
                    <Plus className="w-4 h-4 mr-1" />
                    Add New
                </Button>
            </div>

            {loading ? (
                <div className="animate-pulse space-y-3">
                    <div className="h-16 bg-stone-100 rounded-xl" />
                    <div className="h-16 bg-stone-100 rounded-xl" />
                </div>
            ) : addresses.length === 0 ? (
                <div className="text-center p-6 bg-stone-50 rounded-xl border border-stone-200 border-dashed">
                    <MapPin className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="text-sm text-stone-500 mb-3">No saved addresses found</p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = '/profile'}
                    >
                        Add Address in Profile
                    </Button>
                </div>
            ) : (
                <div className="grid gap-3">
                    {addresses.map((addr) => (
                        <div
                            key={addr.id}
                            onClick={() => onSelectAddress(addr)}
                            className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedAddress?.id === addr.id
                                    ? 'border-emerald-500 bg-emerald-50/50'
                                    : 'border-stone-100 hover:border-emerald-200 hover:bg-stone-50'
                                }`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-stone-900">{addr.label}</span>
                                        {addr.is_default && (
                                            <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
                                                Default
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-stone-600 mt-1">{addr.address}</p>
                                    <p className="text-xs text-stone-500">{addr.city}, {addr.postal_code}</p>
                                </div>
                                {selectedAddress?.id === addr.id && (
                                    <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AddressSelector;
