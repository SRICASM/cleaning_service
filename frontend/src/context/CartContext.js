import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const CartContext = createContext(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

// Multi-visit discount tiers
const getMultiVisitDiscount = (totalVisits) => {
  if (totalVisits >= 48) return 0.20; // 20% off for 12 months (48+ visits)
  if (totalVisits >= 24) return 0.15; // 15% off for 6 months (24+ visits)
  if (totalVisits >= 12) return 0.10; // 10% off for 3 months (12+ visits)
  if (totalVisits >= 4) return 0.05;  // 5% off for 1 month (4+ visits)
  return 0;
};

// Tax rate
const TAX_RATE = 0.05;

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    // Load from localStorage on init
    const saved = localStorage.getItem('cleanupCrew_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('cleanupCrew_cart', JSON.stringify(items));
  }, [items]);

  // Add item to cart with enhanced structure
  const addItem = useCallback((item) => {
    setItems(prev => {
      // For services, check if same service with same options exists
      const existingIndex = prev.findIndex(
        i => i.serviceId === item.serviceId &&
          i.type === item.type &&
          JSON.stringify(i.options) === JSON.stringify(item.options)
      );

      // New enhanced item structure
      const newItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: item.type || 'service', // 'service' | 'addon' | 'subscription'

        // Service details
        serviceId: item.serviceId,
        serviceName: item.serviceName || item.name,
        serviceDescription: item.serviceDescription || item.description,
        serviceImage: item.serviceImage || item.image,
        basePrice: item.basePrice || item.price,

        // Legacy support
        price: item.price,
        originalPrice: item.originalPrice || item.price,
        options: item.options || {},

        // Schedule (to be filled during scheduling step)
        schedule: item.schedule || {
          dates: [], // [{ date: '2025-02-03', time: '09:00 AM', duration: 60 }]
          isRecurring: false,
          recurringPattern: null, // 'weekly' | 'biweekly' | 'monthly'
          preferredDays: [], // ['monday', 'thursday']
          preferredTimeSlot: null // 'morning' | 'afternoon' | 'evening'
        },

        // Add-ons attached to this service
        addOns: item.addOns || [],

        // Subscription details (if applicable)
        subscription: item.subscription || null, // { planId, frequency, visitsPerMonth }

        // Quantity and timestamps
        quantity: item.quantity || 1,
        addedAt: new Date().toISOString(),

        // Address (can be set during review)
        address: item.address || null
      };

      if (existingIndex >= 0 && !item.forceNew) {
        // Update quantity for existing item
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + (item.quantity || 1)
        };
        return updated;
      }

      // Add new item
      return [...prev, newItem];
    });
  }, []);

  // Update item schedule
  const updateItemSchedule = useCallback((itemId, scheduleData) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;

      return {
        ...item,
        schedule: {
          ...item.schedule,
          ...scheduleData
        }
      };
    }));
  }, []);

  // Update item add-ons
  const updateItemAddOns = useCallback((itemId, addOns) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;

      return {
        ...item,
        addOns: addOns
      };
    }));
  }, []);

  // Update item address
  const updateItemAddress = useCallback((itemId, address) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;

      return {
        ...item,
        address: address
      };
    }));
  }, []);

  // Set address for all items
  const setAllItemsAddress = useCallback((address) => {
    setItems(prev => prev.map(item => ({
      ...item,
      address: address
    })));
  }, []);

  // Update item quantity
  const updateQuantity = useCallback((itemId, quantity) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, quantity } : item
    ));
  }, []);

  // Remove item
  const removeItem = useCallback((itemId) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  // Clear cart
  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem('cleanupCrew_cart');
  }, []);

  // Get items that need scheduling
  const getUnscheduledItems = useCallback(() => {
    return items.filter(item =>
      !item.schedule?.dates || item.schedule.dates.length === 0
    );
  }, [items]);

  // Get items that are scheduled
  const getScheduledItems = useCallback(() => {
    return items.filter(item =>
      item.schedule?.dates && item.schedule.dates.length > 0
    );
  }, [items]);

  // Check if all items are scheduled
  const allItemsScheduled = useMemo(() => {
    return items.length > 0 && items.every(item =>
      item.schedule?.dates && item.schedule.dates.length > 0
    );
  }, [items]);

  // Calculate item subtotal (including add-ons and duration)
  const calculateItemSubtotal = useCallback((item) => {
    const visits = item.schedule?.dates?.length || item.quantity || 1;

    // Duration multiplier (base is 60 mins)
    const baseDuration = 60;
    const duration = item.schedule?.dates?.[0]?.duration || baseDuration;
    const durationMultiplier = duration / baseDuration;

    // Base price with duration
    const baseTotal = (item.basePrice || item.price) * durationMultiplier * visits;

    // Add-ons total
    const addOnsTotal = (item.addOns || []).reduce((sum, addon) => {
      const addonPrice = addon.price || 0;
      // Some add-ons are per-visit, some are one-time
      return sum + (addonPrice * (addon.perVisit !== false ? visits : 1));
    }, 0);

    return baseTotal + addOnsTotal;
  }, []);

  // Get total visits across all items
  const totalVisits = useMemo(() => {
    return items.reduce((sum, item) => {
      const visits = item.schedule?.dates?.length || item.quantity || 1;
      return sum + visits;
    }, 0);
  }, [items]);

  // Calculate comprehensive price breakdown
  const priceBreakdown = useMemo(() => {
    let subtotal = 0;
    const itemBreakdowns = [];

    items.forEach(item => {
      const itemSubtotal = calculateItemSubtotal(item);
      subtotal += itemSubtotal;

      const visits = item.schedule?.dates?.length || item.quantity || 1;
      const duration = item.schedule?.dates?.[0]?.duration || 60;

      itemBreakdowns.push({
        id: item.id,
        name: item.serviceName || item.name,
        basePrice: item.basePrice || item.price,
        duration,
        visits,
        addOns: item.addOns || [],
        subtotal: itemSubtotal
      });
    });

    // Multi-visit discount
    const discountRate = getMultiVisitDiscount(totalVisits);
    const discount = subtotal * discountRate;

    // Tax on discounted amount
    const taxableAmount = subtotal - discount;
    const tax = taxableAmount * TAX_RATE;

    // Final total
    const total = taxableAmount + tax;

    return {
      items: itemBreakdowns,
      subtotal,
      totalVisits,
      discountRate,
      discount,
      tax,
      taxRate: TAX_RATE,
      total
    };
  }, [items, totalVisits, calculateItemSubtotal]);

  // Legacy cart totals (for backward compatibility)
  const cartTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + ((item.price || item.basePrice) * item.quantity);
    }, 0);
  }, [items]);

  const cartCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  // Get savings (from discounts)
  const totalSavings = useMemo(() => {
    const originalTotal = items.reduce((sum, item) => {
      const originalPrice = item.originalPrice || item.price || item.basePrice;
      return sum + (originalPrice * item.quantity);
    }, 0);
    return originalTotal - cartTotal + priceBreakdown.discount;
  }, [items, cartTotal, priceBreakdown.discount]);

  // Subscription Plan State (Global for the cart)
  const [selectedPlan, setSelectedPlan] = useState(null); // { name: '1 Month', months: 1, discount: 0.05 }

  // Recalculate discount based on Selected Plan instead of visit count
  const priceBreakdownWithPlan = useMemo(() => {
    const baseBreakdown = priceBreakdown;

    if (!selectedPlan) return baseBreakdown;

    const discountRate = selectedPlan.discount;
    const discount = baseBreakdown.subtotal * discountRate;
    const taxableAmount = baseBreakdown.subtotal - discount;
    const tax = taxableAmount * TAX_RATE;
    const total = taxableAmount + tax;

    return {
      ...baseBreakdown,
      discountRate,
      discount,
      tax,
      total
    };
  }, [priceBreakdown, selectedPlan]);

  const value = {
    // State
    items,
    isCartOpen,
    setIsCartOpen,
    selectedPlan,
    setSelectedPlan,

    // Basic operations
    addItem,
    updateQuantity,
    removeItem,
    clearCart,

    // Schedule operations
    updateItemSchedule,
    updateItemAddOns,
    updateItemAddress,
    setAllItemsAddress,

    // Query methods
    getUnscheduledItems,
    getScheduledItems,
    allItemsScheduled,

    // Price calculations
    calculateItemSubtotal,
    priceBreakdown: priceBreakdownWithPlan, // Use the plan-based breakdown

    // Legacy totals (backward compatibility)
    cartCount,
    cartTotal,
    totalSavings,
    totalVisits,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export default CartContext;
