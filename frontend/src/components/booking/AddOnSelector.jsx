import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Plus, Check, Info } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AddOnSelector = ({ selectedAddOns, onAddOnToggle, onDataLoaded, currency = 'AED' }) => {
    const { getAuthHeaders } = useAuth();
    const [addOns, setAddOns] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAddOns();
    }, []);

    const fetchAddOns = async () => {
        try {
            const response = await axios.get(`${API}/services/add-ons/`, {
                headers: getAuthHeaders()
            });
            let data = response.data || [];

            // If API returns empty (no add-ons in DB yet), use default list
            if (data.length === 0) {
                data = [
                    { id: 101, name: 'Oven Cleaning', price: 50, description: 'Deep clean of oven interior' },
                    { id: 102, name: 'Fridge Cleaning', price: 40, description: 'Deep clean of fridge interior' },
                    { id: 103, name: 'Window Cleaning', price: 75, description: 'Interior window cleaning' },
                    { id: 104, name: 'Laundry & Ironing', price: 60, description: 'Wash, dry and iron clothes' },
                    { id: 105, name: 'Carpet Shampooing', price: 100, description: 'Deep shampoo for carpets' },
                    { id: 106, name: 'Balcony Cleaning', price: 45, description: 'Sweep and wash balcony' },
                ];
            }

            setAddOns(data);
            if (onDataLoaded) onDataLoaded(data);
        } catch (error) {
            console.error('Failed to load add-ons', error);
            // Fallback/Mock data if API fails
            const mockData = [
                { id: 101, name: 'Oven Cleaning', price: 50, description: 'Deep clean of oven interior' },
                { id: 102, name: 'Fridge Cleaning', price: 40, description: 'Deep clean of fridge interior' },
                { id: 103, name: 'Window Cleaning', price: 75, description: 'Interior window cleaning' },
                { id: 104, name: 'Laundry & Ironing', price: 60, description: 'Wash, dry and iron clothes' },
                { id: 105, name: 'Carpet Shampooing', price: 100, description: 'Deep shampoo for carpets' },
                { id: 106, name: 'Balcony Cleaning', price: 45, description: 'Sweep and wash balcony' },
            ];
            setAddOns(mockData);
            if (onDataLoaded) onDataLoaded(mockData);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <h3 className="font-semibold text-green-900">Add-Ons (per visit)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-24 bg-stone-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (addOns.length === 0) return null;

    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-green-900 flex items-center justify-between">
                Add-Ons (per visit)
                <span className="text-xs font-normal text-stone-500">Optional</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addOns.map((addon) => {
                    const isSelected = selectedAddOns.includes(addon.id);

                    return (
                        <button
                            key={addon.id}
                            onClick={() => onAddOnToggle(addon.id)}
                            className={`relative p-4 rounded-xl border-2 transition-all text-left group
                ${isSelected
                                    ? 'border-emerald-500 bg-emerald-50/50'
                                    : 'border-stone-100 hover:border-emerald-200 hover:bg-white bg-white'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`font-medium ${isSelected ? 'text-emerald-900' : 'text-stone-700'}`}>
                                    {addon.name}
                                </span>
                                {isSelected ? (
                                    <div className="flex-shrink-0 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                ) : (
                                    <div className="flex-shrink-0 w-5 h-5 rounded-full border border-stone-200 group-hover:border-emerald-400" />
                                )}
                            </div>

                            <div className="flex items-baseline gap-1">
                                <span className={`font-bold ${isSelected ? 'text-emerald-600' : 'text-stone-900'}`}>
                                    +{currency}{addon.price}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default AddOnSelector;
