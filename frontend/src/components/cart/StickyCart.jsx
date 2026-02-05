import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { Button } from '../ui/button';
import {
  ShoppingCart,
  X,
  Plus,
  Minus,
  Trash2,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Edit2,
  Check
} from 'lucide-react';
import { useState } from 'react';

const CartItem = ({ item, updateQuantity, removeItem }) => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="bg-stone-50 rounded-xl p-3 relative">
      <div className="flex items-center gap-3">
        {/* Image */}
        {(item.serviceImage || item.image) && (
          <img
            src={item.serviceImage || item.image}
            alt={item.serviceName || item.name}
            className="w-16 h-16 object-cover rounded-lg"
          />
        )}

        {/* Details - Compact/Full Toggle */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <p className="font-medium text-green-900 truncate pr-6">{item.serviceName || item.name}</p>
          </div>

          {!isEditing ? (
            // COMPACT VIEW
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm text-stone-500">
                Qty: {item.quantity}
              </p>
              <div className="flex items-center gap-2">
                <p className="font-bold text-emerald-600">
                  AED {((item.basePrice || item.price) * item.quantity).toFixed(0)}
                </p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 bg-white rounded-full border border-stone-200 text-stone-500 hover:text-emerald-600 hover:border-emerald-200 ml-2"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            // EDIT VIEW
            <div className="mt-1 animate-fadeIn">
              <p className="text-sm text-stone-500 capitalize mb-1">{item.type}</p>
              {item.options && Object.keys(item.options).length > 0 && (
                <p className="text-xs text-stone-400 mb-2">
                  {Object.entries(item.options)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' • ')}
                </p>
              )}

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2 bg-white rounded-full border border-stone-200 px-2 py-1 shadow-sm">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="p-1 hover:bg-stone-100 rounded-full text-stone-600"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center font-medium text-sm">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="p-1 hover:bg-stone-100 rounded-full text-stone-600"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="p-2 bg-emerald-500 text-white rounded-full shadow-md hover:bg-emerald-600 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


const StickyCart = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    items,
    cartCount,
    cartTotal,
    totalSavings,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeItem,
    clearCart
  } = useCart();

  // Use isCartOpen from context for expanded state
  const isExpanded = isCartOpen;
  const setIsExpanded = setIsCartOpen;

  const handleCheckout = () => {
    setIsExpanded(false);
    // Navigate to unified booking flow where users can schedule their cart items
    navigate('/booking');
  };

  // Hide on booking page - user is already in the booking flow
  const isBookingPage = location.pathname.startsWith('/booking');
  if (isBookingPage) return null;

  // Don't render collapsed bar if cart is empty, but allow expanded view to open
  if (cartCount === 0 && !isExpanded) return null;

  return (
    <>
      {/* Backdrop when expanded */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Cart Panel - Bottom sheet on mobile, side drawer on desktop */}
      <div
        className={`fixed z-50 transition-all duration-300 ${isExpanded
          ? 'inset-0 lg:inset-auto lg:top-0 lg:right-0 lg:bottom-0 lg:w-[400px]'
          : 'bottom-0 left-0 right-0'
          }`}
      >
        {/* Expanded View */}
        {isExpanded && (
          <div className="bg-white h-full flex flex-col shadow-2xl lg:border-l border-stone-200 rounded-t-3xl lg:rounded-none mt-auto lg:mt-0 max-h-[80vh] lg:max-h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 -ml-2 mr-1 hover:bg-stone-100 rounded-full text-stone-600"
                >
                  <ArrowRight className="w-6 h-6 rotate-180" /> {/* Using ArrowRight rotated as "Back" */}
                </button>
                <ShoppingCart className="w-5 h-5 text-green-900" />
                <h3 className="font-semibold text-green-900">
                  Your Cart {cartCount > 0 && `(${cartCount})`}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {cartCount > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-sm text-red-500 hover:text-red-600 px-2"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-stone-300 mb-4" />
                  <h4 className="font-semibold text-green-900 mb-2">Your cart is empty</h4>
                  <p className="text-stone-500 text-sm mb-6">
                    Browse our services and add items to your cart
                  </p>
                  <Button
                    onClick={() => {
                      setIsExpanded(false);
                      navigate('/services');
                    }}
                    className="bg-emerald-500 hover:bg-emerald-600 rounded-full"
                  >
                    Browse Services
                  </Button>
                </div>
              ) : (
                items.map((item) => (
                  <CartItem
                    key={item.id}
                    item={item}
                    updateQuantity={updateQuantity}
                    removeItem={removeItem}
                  />
                ))
              )}
            </div>

            {/* Savings Banner & Checkout Footer - only show if items exist */}
            {items.length > 0 && (
              <>
                {totalSavings > 0 && (
                  <div className="mx-4 mb-2 px-4 py-2 bg-emerald-50 rounded-lg flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm text-emerald-700 font-medium">
                      You're saving AED {totalSavings.toFixed(0)}!
                    </span>
                  </div>
                )}

                {/* Checkout Footer */}
                <div className="p-4 border-t border-stone-200 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-stone-600">Total</span>
                    <span className="text-2xl font-bold text-green-900">
                      AED {cartTotal.toFixed(0)}
                    </span>
                  </div>
                  <Button
                    onClick={handleCheckout}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 h-14 text-lg rounded-full"
                  >
                    Schedule & Book
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Collapsed Bar */}
        {!isExpanded && (
          <div
            className="bg-white border-t border-emerald-100 shadow-lg px-4 py-3 cursor-pointer transition-all hover:bg-stone-50"
            onClick={() => setIsExpanded(true)}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingCart className="w-6 h-6 text-emerald-600" />
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                    {cartCount}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{cartCount} item{cartCount > 1 ? 's' : ''}</p>
                  {totalSavings > 0 && (
                    <p className="text-xs text-emerald-600 font-medium">Saving AED {totalSavings.toFixed(0)}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xl font-bold text-gray-900">AED {cartTotal.toFixed(0)}</span>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCheckout();
                  }}
                  className="bg-gray-900 hover:bg-gray-800 text-white rounded-xl px-6 shadow-lg shadow-gray-200"
                >
                  Checkout
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <ChevronUp className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spacer to prevent content overlap when generic collapsed bar is visible */}
      {!isExpanded && cartCount > 0 && !isBookingPage && (
        <div className="h-20" aria-hidden="true" />
      )}
    </>
  );
};

export default StickyCart;
