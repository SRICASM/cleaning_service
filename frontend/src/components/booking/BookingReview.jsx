import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Calendar, Tag, Check, Percent, X, AlertCircle, Wallet, CreditCard, Banknote } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import AddressSelector from './AddressSelector';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BookingReview = ({ onContinue, onBack }) => {
  const { priceBreakdown, selectedPlan } = useCart();
  const { items, subtotal, discount, tax, total } = priceBreakdown;
  const { token } = useAuth();

  const [selectedAddress, setSelectedAddress] = useState(null);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        if (!token) return;
        const response = await axios.get(`${API}/wallet/summary`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setWalletBalance(response.data.balance || 0);
      } catch (err) {
        console.error("Failed to fetch wallet", err);
      }
    };
    fetchWallet();
  }, [token]);

  const handleApplyPromo = () => {
    if (promoCode.toLowerCase() === 'save10') {
      setPromoDiscount(10);
      setPromoApplied(true);
      toast.success('Promo code applied!');
    } else {
      toast.error('Invalid promo code');
    }
  };

  const finalTotal = total - promoDiscount;
  const canProceed = !!selectedAddress;
  const canPayWithWallet = walletBalance >= finalTotal;

  // Auto-switch to card if wallet insufficient
  useEffect(() => {
    if (paymentMethod === 'wallet' && !canPayWithWallet) {
      setPaymentMethod('card');
    }
  }, [canPayWithWallet, paymentMethod]);


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-green-900 mb-2">Review Your Booking</h2>
        <p className="text-stone-600">
          Confirm your details before proceeding to payment
        </p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-8 relative items-start">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Services Summary */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Services ({items.length})
            </h3>
            {items.length === 0 ? (
              <div className="text-stone-500 italic">No items in cart.</div>
            ) : (
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.id} className="flex justify-between p-4 bg-stone-50 rounded-xl">
                    <div>
                      <p className="font-medium text-stone-900">{item.name}</p>
                      <p className="text-sm text-stone-500">
                        {item.visits} {item.visits === 1 ? 'visit' : 'visits'}
                        {item.duration && ` • ${item.duration} min`}
                      </p>
                      {item.addOns && item.addOns.length > 0 && (
                        <p className="text-xs text-stone-400 mt-1">
                          + {item.addOns.map(a => a.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-stone-900">${item.subtotal.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Address Selection */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <AddressSelector
              selectedAddress={selectedAddress}
              onSelectAddress={setSelectedAddress}
            />
          </div>

          {/* Payment Method Selection */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-4">Payment Method</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => setPaymentMethod('card')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'card'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-stone-200 hover:border-emerald-200'
                  }`}
              >
                <CreditCard className="w-6 h-6" />
                <span className="font-medium">Card</span>
              </button>

              <button
                onClick={() => setPaymentMethod('wallet')}
                disabled={!canPayWithWallet}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all relative ${paymentMethod === 'wallet'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : canPayWithWallet
                    ? 'border-stone-200 hover:border-emerald-200 text-stone-700'
                    : 'border-stone-100 bg-stone-50 text-stone-400 cursor-not-allowed'
                  }`}
              >
                <div className="relative">
                  <Wallet className="w-6 h-6" />
                  {canPayWithWallet && <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full"></div>}
                </div>
                <div className="text-center">
                  <span className="font-medium block">Wallet</span>
                  <span className="text-xs">AED {walletBalance.toFixed(2)}</span>
                </div>
              </button>

              <button
                onClick={() => setPaymentMethod('cash')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'cash'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-stone-200 hover:border-emerald-200'
                  }`}
              >
                <Banknote className="w-6 h-6" />
                <span className="font-medium">Cash</span>
              </button>
            </div>
            {!canPayWithWallet && walletBalance > 0 && walletBalance < finalTotal && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Insufficient wallet balance to cover full amount.
              </p>
            )}
          </div>

          {/* Special Instructions */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-3">Special Instructions</h3>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Any special requests or instructions for the cleaner..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-stone-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Right Column: Sticky Summary */}
        <div className="lg:col-span-1 lg:sticky lg:top-24 space-y-6">
          {/* Price Breakdown */}
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-lg shadow-emerald-50 overflow-hidden">
            {/* Savings Badge */}
            {(discount > 0 || promoDiscount > 0) && (
              <div className="bg-emerald-500 text-white text-center py-2 text-sm font-bold">
                You saved ${(discount + promoDiscount).toFixed(2)}!
              </div>
            )}

            <div className="p-6">
              <h3 className="font-semibold text-green-900 mb-4">Order Summary</h3>

              {/* Promo Code Input */}
              <div className="mb-6 pb-6 border-b border-stone-100">
                {!promoApplied ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="Promo code"
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <Button onClick={handleApplyPromo} disabled={!promoCode} size="sm" variant="outline">
                      Apply
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg text-sm">
                    <span className="font-medium text-emerald-700 flex items-center gap-1">
                      <Tag className="w-3 h-3" /> {promoCode.toUpperCase()}
                    </span>
                    <button onClick={() => { setPromoApplied(false); setPromoDiscount(0); setPromoCode(''); }} className="text-stone-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>

                {selectedPlan && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      {selectedPlan.name} Plan
                    </span>
                    <span>-${discount.toFixed(2)}</span>
                  </div>
                )}

                {promoDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Promo Discount</span>
                    <span>-${promoDiscount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-stone-600">
                  <span>Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>

                <div className="pt-4 mt-4 border-t border-stone-100 flex justify-between items-end">
                  <span className="font-bold text-green-900 text-lg">Total</span>
                  <span className="font-bold text-emerald-600 text-2xl">${finalTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Button
                  onClick={() => onContinue({
                    address: selectedAddress,
                    paymentMethod,
                    specialInstructions,
                    useSubscription: false,
                    finalTotal: finalTotal,
                    newSubscriptionPlanId: selectedPlan?.id || null,
                    isWalletPayment: paymentMethod === 'wallet'
                  })}
                  disabled={!canProceed}
                  className={`w-full rounded-full h-12 text-white font-bold text-lg shadow-lg shadow-emerald-200 ${canProceed
                    ? 'bg-gradient-to-r from-emerald-500 to-lime-500 hover:from-emerald-600 hover:to-lime-600'
                    : 'bg-stone-300 cursor-not-allowed shadow-none'
                    }`}
                >
                  Confirm Booking
                </Button>
                <Button
                  onClick={onBack}
                  variant="ghost"
                  className="w-full rounded-full h-10 text-stone-500 hover:text-stone-700"
                >
                  Back to Schedule
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingReview;
