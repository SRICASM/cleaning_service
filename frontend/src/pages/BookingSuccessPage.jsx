import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import axios from 'axios';
import { CheckCircle, Loader2, Calendar, ArrowRight, Sparkles } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BookingSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const { getAuthHeaders } = useAuth();
  const [status, setStatus] = useState('checking');
  const attemptsRef = useRef(0);
  const pollingRef = useRef(false);

  const sessionId = searchParams.get('session_id');

  const pollStatus = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;

    const poll = async () => {
      try {
        const response = await axios.get(`${API}/payments/status/${sessionId}`, {
          headers: getAuthHeaders()
        });

        if (response.data.payment_status === 'paid') {
          setStatus('success');
        } else if (attemptsRef.current < 5) {
          attemptsRef.current += 1;
          setTimeout(poll, 2000);
        } else {
          setStatus('pending');
        }
      } catch (error) {
        if (attemptsRef.current < 5) {
          attemptsRef.current += 1;
          setTimeout(poll, 2000);
        } else {
          setStatus('error');
        }
      }
    };

    poll();
  }, [sessionId, getAuthHeaders]);

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }

    pollStatus();
  }, [sessionId, pollStatus]);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {status === 'checking' && (
          <>
            <div className="w-20 h-20 rounded-full bg-lime-100 flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-lime-600 animate-spin" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-green-900 mb-2">
              Confirming your payment...
            </h1>
            <p className="text-stone-600">
              Please wait while we verify your payment.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 rounded-full bg-lime-100 flex items-center justify-center mx-auto mb-6 animate-fadeInUp">
              <CheckCircle className="w-10 h-10 text-lime-600" />
            </div>
            <h1 className="font-heading text-3xl font-bold text-green-900 mb-2 animate-fadeInUp">
              Booking Confirmed!
            </h1>
            <p className="text-stone-600 mb-8 animate-fadeInUp stagger-1">
              Thank you for your booking. We've sent a confirmation to your email.
            </p>
            <div className="flex flex-col gap-3 animate-fadeInUp stagger-2">
              <Link to="/dashboard">
                <Button className="w-full bg-green-900 hover:bg-green-800 text-white rounded-full h-12" data-testid="success-dashboard">
                  View My Bookings
                  <Calendar className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline" className="w-full rounded-full h-12" data-testid="success-home">
                  Back to Home
                </Button>
              </Link>
            </div>
          </>
        )}

        {status === 'pending' && (
          <>
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-amber-600" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-green-900 mb-2">
              Payment Processing
            </h1>
            <p className="text-stone-600 mb-8">
              Your payment is being processed. You'll receive a confirmation email shortly.
            </p>
            <Link to="/dashboard">
              <Button className="bg-green-900 hover:bg-green-800 text-white rounded-full" data-testid="pending-dashboard">
                Go to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-green-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-stone-600 mb-8">
              We couldn't verify your payment. Please check your dashboard or contact support.
            </p>
            <div className="flex flex-col gap-3">
              <Link to="/dashboard">
                <Button className="w-full bg-green-900 hover:bg-green-800 text-white rounded-full" data-testid="error-dashboard">
                  Check Dashboard
                </Button>
              </Link>
              <Link to="/contact">
                <Button variant="outline" className="w-full rounded-full" data-testid="error-contact">
                  Contact Support
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BookingSuccessPage;
