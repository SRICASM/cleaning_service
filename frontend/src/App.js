import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import StickyCart from "./components/cart/StickyCart";
import HomePage from "./pages/HomePage";
import ServicesPage from "./pages/ServicesPage";
import BookingPage from "./pages/BookingPage";
import BookingSuccessPage from "./pages/BookingSuccessPage";
import BookingCancelPage from "./pages/BookingCancelPage";
import LoginPage from "./pages/LoginPage";
import CleanerLoginPage from "./pages/CleanerLoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import PropertySetupPage from "./pages/PropertySetupPage";
import ProfilePage from "./pages/ProfilePage";
import DashboardPage from "./pages/DashboardPage";
import AdminDashboard from "./pages/AdminDashboard";
import CleanerDashboard from "./pages/CleanerDashboard";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";

import SubscriptionPlansPage from "./pages/SubscriptionPlansPage";
import SubscriptionCheckoutPage from "./pages/SubscriptionCheckoutPage";
import SubscriptionManagePage from "./pages/SubscriptionManagePage";
import InstantBookingPage from "./pages/InstantBookingPage";
import ScheduleBookingPage from "./pages/ScheduleBookingPage";
import WalletPage from "./pages/WalletPage";
import ReferralPage from "./pages/ReferralPage";
import UpdateNotification from "./components/UpdateNotification";
import OfflineIndicator from "./components/OfflineIndicator";
import InstallAppButton from "./components/InstallAppButton";
import axios from "axios";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false, allowedUserTypes = [] }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-900"></div>
      </div>
    );
  }

  if (!user) {
    // Redirect based on where they might be trying to go
    if (window.location.pathname.startsWith('/cleaner')) {
      return <Navigate to="/cleaner/login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  if (allowedUserTypes.length > 0 && !allowedUserTypes.includes(user.user_type)) {
    // If cleaner tries to access customer dashboard
    if (user.user_type === 'EMPLOYEE') return <Navigate to="/cleaner/dashboard" replace />;
    // If customer tries to access cleaner dashboard
    if (user.user_type === 'CUSTOMER') return <Navigate to="/dashboard" replace />;

    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  useEffect(() => {
    // Seed data on app load
    const seedData = async () => {
      try {
        await axios.post(`${API}/seed`);
      } catch (e) {
        console.log("Seed completed or already seeded");
      }
    };
    seedData();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cleaner/login" element={<CleanerLoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/setup-property"
        element={
          <ProtectedRoute>
            <PropertySetupPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/booking"
        element={
          <ProtectedRoute>
            <BookingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/instant-booking"
        element={
          <ProtectedRoute>
            <InstantBookingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedule-booking"
        element={
          <ProtectedRoute>
            <ScheduleBookingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/booking/success"
        element={
          <ProtectedRoute>
            <BookingSuccessPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/booking/cancel"
        element={
          <ProtectedRoute>
            <BookingCancelPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cleaner/dashboard"
        element={
          <ProtectedRoute allowedUserTypes={['EMPLOYEE']}>
            <CleanerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute adminOnly>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Subscription Routes */}
      <Route path="/subscriptions" element={<SubscriptionPlansPage />} />
      <Route
        path="/subscriptions/checkout/:planId"
        element={
          <ProtectedRoute>
            <SubscriptionCheckoutPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscriptions/:subscriptionId"
        element={
          <ProtectedRoute>
            <SubscriptionManagePage />
          </ProtectedRoute>
        }
      />

      {/* Wallet & Referral Routes */}
      <Route
        path="/wallet"
        element={
          <ProtectedRoute>
            <WalletPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/referrals"
        element={
          <ProtectedRoute>
            <ReferralPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          {/* PWA Components */}
          <UpdateNotification />
          <OfflineIndicator />

          <AppRoutes />
          <StickyCart />
          <InstallAppButton variant="floating" />
          <Toaster position="top-right" richColors />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
