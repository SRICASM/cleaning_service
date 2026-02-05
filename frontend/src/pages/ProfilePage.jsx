import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { getErrorMessage } from '../utils/errorUtils';
import axios from 'axios';
import {
    User,
    Mail,
    Phone,
    Home,
    MapPin,
    Edit,
    Trash2,
    Plus,
    Star,
    Check,
    X,
    Loader2,
    Navigation,
    BedDouble,
    Bath
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ProfilePage = () => {
    const { user, getAuthHeaders, setUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [addresses, setAddresses] = useState([]);
    const [addressLoading, setAddressLoading] = useState(true);

    // Profile form state
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [propertyType, setPropertyType] = useState('house');
    const [bedrooms, setBedrooms] = useState(2);
    const [bathrooms, setBathrooms] = useState(1);

    // Address modal state
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [editingAddress, setEditingAddress] = useState(null);
    const [addressForm, setAddressForm] = useState({
        label: '',
        address: '',
        city: '',
        postal_code: '',
        is_default: false
    });
    const [addressSaving, setAddressSaving] = useState(false);
    const [geoLoading, setGeoLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setPhone(user.phone || '');
            setPropertyType(user.property_type || 'house');
            setBedrooms(user.bedrooms || 2);
            setBathrooms(user.bathrooms || 1);
            fetchAddresses();
        }
    }, [user]);

    const fetchAddresses = async () => {
        try {
            const response = await axios.get(`${API}/users/me/addresses`, {
                headers: getAuthHeaders()
            });
            setAddresses(response.data);
        } catch (error) {
            toast.error('Failed to load addresses');
        } finally {
            setAddressLoading(false);
        }
    };

    const handleProfileSave = async () => {
        setLoading(true);
        try {
            const response = await axios.put(`${API}/users/profile`, {
                name,
                phone,
                property_type: propertyType,
                bedrooms,
                bathrooms
            }, {
                headers: getAuthHeaders()
            });
            setUser(response.data);
            toast.success('Profile updated successfully');
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to update profile'));
        } finally {
            setLoading(false);
        }
    };

    const openAddressModal = (address = null) => {
        if (address) {
            setEditingAddress(address);
            setAddressForm({
                label: address.label,
                address: address.address,
                city: address.city,
                postal_code: address.postal_code,
                is_default: address.is_default
            });
        } else {
            setEditingAddress(null);
            setAddressForm({
                label: '',
                address: '',
                city: '',
                postal_code: '',
                is_default: false
            });
        }
        setShowAddressModal(true);
    };

    const handleAddressSave = async () => {
        if (!addressForm.label || !addressForm.address || !addressForm.city || !addressForm.postal_code) {
            toast.error('Please fill all address fields');
            return;
        }

        setAddressSaving(true);
        try {
            if (editingAddress) {
                await axios.put(`${API}/users/me/addresses/${editingAddress.id}`, {
                    label: addressForm.label,
                    address: addressForm.address,
                    city: addressForm.city,
                    postal_code: addressForm.postal_code
                }, {
                    headers: getAuthHeaders()
                });
                toast.success('Address updated');
            } else {
                await axios.post(`${API}/users/me/addresses`, addressForm, {
                    headers: getAuthHeaders()
                });
                toast.success('Address added');
            }
            setShowAddressModal(false);
            fetchAddresses();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to save address'));
        } finally {
            setAddressSaving(false);
        }
    };

    const handleDeleteAddress = async (addressId) => {
        if (!window.confirm('Are you sure you want to delete this address?')) return;

        try {
            await axios.delete(`${API}/users/me/addresses/${addressId}`, {
                headers: getAuthHeaders()
            });
            toast.success('Address deleted');
            fetchAddresses();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to delete address'));
        }
    };

    const handleSetDefault = async (addressId) => {
        try {
            await axios.put(`${API}/users/me/addresses/${addressId}/default`, {}, {
                headers: getAuthHeaders()
            });
            toast.success('Default address updated');
            fetchAddresses();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to set default'));
        }
    };

    const handleUseCurrentLocation = async () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }

        setGeoLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    // Use reverse geocoding to get address (using Nominatim free API)
                    const response = await axios.get(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                    );
                    const data = response.data;
                    if (data && data.address) {
                        setAddressForm({
                            ...addressForm,
                            address: `${data.address.road || ''} ${data.address.house_number || ''}`.trim() || data.display_name?.split(',')[0] || '',
                            city: data.address.city || data.address.town || data.address.village || data.address.municipality || '',
                            postal_code: data.address.postcode || ''
                        });
                        toast.success('Location detected!');
                    }
                } catch (error) {
                    toast.error('Could not get address from location');
                } finally {
                    setGeoLoading(false);
                }
            },
            (error) => {
                setGeoLoading(false);
                if (error.code === error.PERMISSION_DENIED) {
                    toast.error('Location permission denied');
                } else {
                    toast.error('Could not get your location');
                }
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    };

    return (
        <div className="min-h-screen bg-stone-50 flex flex-col">
            <Navbar />

            <main className="flex-1 pt-24 pb-12 px-6">
                <div className="max-w-4xl mx-auto">
                    <h1 className="font-heading text-3xl font-bold text-green-900 mb-8">
                        My Profile
                    </h1>

                    {/* Personal Details Section */}
                    <section className="bg-white rounded-3xl border border-stone-200 p-8 mb-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                <User className="w-5 h-5 text-green-700" />
                            </div>
                            <h2 className="font-heading text-xl font-semibold text-green-900">
                                Personal Details
                            </h2>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <Label htmlFor="name">Full Name</Label>
                                <div className="relative mt-2">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                    <Input
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="email">Email</Label>
                                <div className="relative mt-2">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                    <Input
                                        id="email"
                                        value={user?.email || ''}
                                        disabled
                                        className="pl-10 bg-stone-50"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="phone">Phone Number</Label>
                                <div className="relative mt-2">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                    <Input
                                        id="phone"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="pl-10"
                                        placeholder="Your phone number"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Property Details Section */}
                    <section className="bg-white rounded-3xl border border-stone-200 p-8 mb-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-lime-100 flex items-center justify-center">
                                <Home className="w-5 h-5 text-lime-700" />
                            </div>
                            <h2 className="font-heading text-xl font-semibold text-green-900">
                                Property Details
                            </h2>
                        </div>

                        <div className="grid md:grid-cols-3 gap-6">
                            <div>
                                <Label htmlFor="propertyType">Property Type</Label>
                                <div className="relative mt-2">
                                    <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                    <select
                                        id="propertyType"
                                        value={propertyType}
                                        onChange={(e) => setPropertyType(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 appearance-none bg-white"
                                    >
                                        <option value="apartment">Apartment</option>
                                        <option value="house">House</option>
                                        <option value="condo">Condo</option>
                                        <option value="studio">Studio</option>
                                        <option value="townhouse">Townhouse</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="bedrooms">Bedrooms</Label>
                                <div className="relative mt-2">
                                    <BedDouble className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                    <select
                                        id="bedrooms"
                                        value={bedrooms}
                                        onChange={(e) => setBedrooms(Number(e.target.value))}
                                        className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 appearance-none bg-white"
                                    >
                                        {[1, 2, 3, 4, 5, 6].map(n => (
                                            <option key={n} value={n}>{n} {n === 1 ? 'Bedroom' : 'Bedrooms'}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="bathrooms">Bathrooms</Label>
                                <div className="relative mt-2">
                                    <Bath className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                    <select
                                        id="bathrooms"
                                        value={bathrooms}
                                        onChange={(e) => setBathrooms(Number(e.target.value))}
                                        className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 appearance-none bg-white"
                                    >
                                        {[1, 2, 3, 4, 5].map(n => (
                                            <option key={n} value={n}>{n} {n === 1 ? 'Bathroom' : 'Bathrooms'}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Button
                                onClick={handleProfileSave}
                                disabled={loading}
                                className="bg-green-950 hover:bg-green-900 text-white rounded-xl px-8 shadow-sm"
                            >
                                {loading ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </section>

                    {/* Addresses Section */}
                    <section className="bg-white rounded-3xl border border-stone-200 p-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                    <MapPin className="w-5 h-5 text-blue-700" />
                                </div>
                                <h2 className="font-heading text-xl font-semibold text-green-900">
                                    Saved Addresses
                                </h2>
                            </div>
                            <Button
                                onClick={() => openAddressModal()}
                                className="bg-green-950 hover:bg-green-900 text-white rounded-xl shadow-sm"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Address
                            </Button>
                        </div>

                        {addressLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                            </div>
                        ) : addresses.length === 0 ? (
                            <div className="text-center py-8 text-stone-500">
                                <MapPin className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                <p>No saved addresses yet</p>
                                <p className="text-sm">Add an address to use during booking</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {addresses.map((addr) => (
                                    <div
                                        key={addr.id}
                                        className={`p-4 rounded-xl border ${addr.is_default ? 'border-green-300 bg-green-50' : 'border-stone-200'}`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-semibold text-green-900">{addr.label}</span>
                                                    {addr.is_default && (
                                                        <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full">
                                                            Default
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-stone-600">{addr.address}</p>
                                                <p className="text-stone-500 text-sm">{addr.city}, {addr.postal_code}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {!addr.is_default && (
                                                    <button
                                                        onClick={() => handleSetDefault(addr.id)}
                                                        className="p-2 text-stone-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                                                        title="Set as default"
                                                    >
                                                        <Star className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => openAddressModal(addr)}
                                                    className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAddress(addr.id)}
                                                    className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>

            <Footer />

            {/* Address Modal */}
            {showAddressModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-heading text-xl font-semibold text-green-900">
                                {editingAddress ? 'Edit Address' : 'Add New Address'}
                            </h3>
                            <button
                                onClick={() => setShowAddressModal(false)}
                                className="text-stone-400 hover:text-stone-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="addressLabel">Label</Label>
                                <Input
                                    id="addressLabel"
                                    value={addressForm.label}
                                    onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                                    placeholder="e.g., Home, Office, Parents"
                                    className="mt-2"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="addressStreet">Street Address</Label>
                                    <button
                                        onClick={handleUseCurrentLocation}
                                        disabled={geoLoading}
                                        className="text-sm text-green-700 hover:text-green-900 flex items-center gap-1"
                                    >
                                        {geoLoading ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Navigation className="w-3 h-3" />
                                        )}
                                        Use current location
                                    </button>
                                </div>
                                <Input
                                    id="addressStreet"
                                    value={addressForm.address}
                                    onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
                                    placeholder="123 Main Street"
                                    className="mt-2"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="addressCity">City</Label>
                                    <Input
                                        id="addressCity"
                                        value={addressForm.city}
                                        onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                                        placeholder="City"
                                        className="mt-2"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="addressPostal">Postal Code</Label>
                                    <Input
                                        id="addressPostal"
                                        value={addressForm.postal_code}
                                        onChange={(e) => setAddressForm({ ...addressForm, postal_code: e.target.value })}
                                        placeholder="12345"
                                        className="mt-2"
                                    />
                                </div>
                            </div>

                            {!editingAddress && (
                                <label className="flex items-center gap-2 text-sm text-stone-600">
                                    <input
                                        type="checkbox"
                                        checked={addressForm.is_default}
                                        onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                                        className="rounded border-stone-300"
                                    />
                                    Set as default address
                                </label>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="outline"
                                onClick={() => setShowAddressModal(false)}
                                className="flex-1 rounded-full"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddressSave}
                                disabled={addressSaving}
                                className="flex-1 bg-green-950 hover:bg-green-900 text-white rounded-xl shadow-sm"
                            >
                                {addressSaving ? 'Saving...' : (editingAddress ? 'Update' : 'Add Address')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfilePage;
