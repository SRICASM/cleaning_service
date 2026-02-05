import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gift, Copy, Share2, Users, CheckCircle, Clock, Sparkles,
  ArrowLeft, MessageCircle, Mail, Link2, Trophy, TrendingUp,
  ChevronRight, Star, Wallet
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ReferralPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState(null);
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [copied, setCopied] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyCode, setApplyCode] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchReferralData();
      fetchLeaderboard();
    }
  }, [token]);

  const fetchReferralData = async () => {
    try {
      const [codeRes, statsRes] = await Promise.all([
        fetch(`${API}/referrals/code`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/referrals/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (codeRes.ok) {
        const codeData = await codeRes.json();
        setReferralCode(codeData);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API}/referrals/leaderboard?limit=5`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralCode?.code || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = referralCode?.code || '';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareViaWhatsApp = () => {
    const message = encodeURIComponent(referralCode?.share_message || '');
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const shareViaSMS = () => {
    const message = encodeURIComponent(referralCode?.share_message || '');
    window.open(`sms:?body=${message}`, '_blank');
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent('Join CleanUpCrew - Get AED 25 Off!');
    const body = encodeURIComponent(referralCode?.share_message || '');
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join CleanUpCrew',
          text: referralCode?.share_message || '',
          url: referralCode?.share_url || ''
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    }
  };

  const handleApplyCode = async () => {
    if (!applyCode.trim()) {
      alert('Please enter a referral code');
      return;
    }

    setApplyLoading(true);
    try {
      const response = await fetch(`${API}/referrals/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: applyCode.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        setShowApplyModal(false);
        setApplyCode('');
        fetchReferralData();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to apply code');
      }
    } catch (error) {
      console.error('Apply code error:', error);
      alert('Failed to apply referral code');
    } finally {
      setApplyLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-medium">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-stone-600 hover:text-green-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-lg mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Gift className="w-6 h-6" />
                <span className="text-amber-100 font-medium">Refer & Earn</span>
              </div>
              <h1 className="text-2xl font-bold mb-2">
                Earn AED 50 for every friend!
              </h1>
              <p className="text-amber-100 text-sm">
                Share your code with friends. They get AED 25 off their first booking,
                and you earn AED 50 when they complete it!
              </p>
            </div>
            <div className="hidden md:block">
              <Sparkles className="w-16 h-16 text-amber-200/50" />
            </div>
          </div>
        </div>

        {/* Referral Code Card */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-green-900 mb-4">Your Referral Code</h2>

          <div className="bg-stone-50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-500 mb-1">Share this code</p>
                <p className="text-2xl font-bold text-green-900 tracking-wider">
                  {referralCode?.code || '------'}
                </p>
              </div>
              <button
                onClick={copyToClipboard}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                  copied
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Share Options */}
          <p className="text-sm text-stone-500 mb-3">Share via</p>
          <div className="grid grid-cols-4 gap-3">
            <button
              onClick={shareViaWhatsApp}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-green-50 hover:bg-green-100 transition-colors"
            >
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs text-stone-600">WhatsApp</span>
            </button>

            <button
              onClick={shareViaSMS}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs text-stone-600">SMS</span>
            </button>

            <button
              onClick={shareViaEmail}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors"
            >
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs text-stone-600">Email</span>
            </button>

            {navigator.share && (
              <button
                onClick={shareNative}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors"
              >
                <div className="w-10 h-10 bg-stone-500 rounded-full flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs text-stone-600">More</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="flex items-center gap-2 text-stone-500 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-xs">Total Referrals</span>
            </div>
            <p className="text-2xl font-bold text-green-900">{stats?.total_referrals || 0}</p>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="flex items-center gap-2 text-emerald-500 mb-2">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs">Successful</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{stats?.successful_referrals || 0}</p>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="flex items-center gap-2 text-amber-500 mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-xs">Pending</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{stats?.pending_referrals || 0}</p>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <div className="flex items-center gap-2 text-purple-500 mb-2">
              <Wallet className="w-4 h-4" />
              <span className="text-xs">Total Earned</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">AED {stats?.total_earnings || 0}</p>
          </div>
        </div>

        {/* Have a Code? */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <Link2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-green-900">Have a referral code?</p>
                <p className="text-sm text-emerald-600">Apply it and get AED 25 in your wallet!</p>
              </div>
            </div>
            <button
              onClick={() => setShowApplyModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              Apply Code
            </button>
          </div>
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-6">
            <div className="p-4 border-b border-stone-200 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-green-900">Top Referrers</h2>
            </div>
            <div className="divide-y divide-stone-100">
              {leaderboard.map((entry, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      idx === 0 ? 'bg-amber-100 text-amber-600' :
                      idx === 1 ? 'bg-stone-200 text-stone-600' :
                      idx === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-stone-100 text-stone-500'
                    }`}>
                      {entry.rank}
                    </div>
                    <div>
                      <p className="font-medium text-green-900">{entry.name}</p>
                      <p className="text-xs text-stone-500">{entry.referrals} referrals</p>
                    </div>
                  </div>
                  <p className="font-semibold text-emerald-600">AED {entry.earnings}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Referral History */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-200">
            <h2 className="text-lg font-semibold text-green-900">Your Referrals</h2>
          </div>

          {(!stats?.referrals || stats.referrals.length === 0) ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-stone-400" />
              </div>
              <p className="text-stone-600 font-medium">No referrals yet</p>
              <p className="text-sm text-stone-500 mt-1">Share your code and start earning!</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {stats.referrals.map((referral) => (
                <div key={referral.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center">
                        <span className="text-stone-600 font-medium text-sm">
                          {referral.referred_name?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-green-900">{referral.referred_name}</p>
                        <p className="text-xs text-stone-500">{referral.referred_email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(referral.status)}
                      {referral.status === 'completed' && (
                        <p className="text-sm text-emerald-600 font-medium mt-1">
                          +AED {referral.reward_amount}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* How It Works */}
        <div className="mt-6 bg-white rounded-xl border border-stone-200 p-6">
          <h2 className="text-lg font-semibold text-green-900 mb-4">How It Works</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-600 font-bold text-sm">1</span>
              </div>
              <div>
                <p className="font-medium text-green-900">Share Your Code</p>
                <p className="text-sm text-stone-500">Send your unique referral code to friends and family</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-600 font-bold text-sm">2</span>
              </div>
              <div>
                <p className="font-medium text-green-900">Friend Signs Up</p>
                <p className="text-sm text-stone-500">They register with your code and get AED 25 instantly</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-600 font-bold text-sm">3</span>
              </div>
              <div>
                <p className="font-medium text-green-900">You Earn AED 50</p>
                <p className="text-sm text-stone-500">When they complete their first booking, you get AED 50!</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Apply Code Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-green-900 mb-4">Apply Referral Code</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Enter Code
              </label>
              <input
                type="text"
                value={applyCode}
                onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
                placeholder="e.g., CUCAB123"
                maxLength={10}
                className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg uppercase tracking-wider"
              />
            </div>

            <div className="bg-emerald-50 rounded-lg p-3 mb-6">
              <p className="text-sm text-emerald-700">
                <strong>Bonus:</strong> You'll receive AED 25 in your wallet when you apply a valid referral code!
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApplyModal(false);
                  setApplyCode('');
                }}
                className="flex-1 py-3 border border-stone-300 rounded-xl font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyCode}
                disabled={applyLoading || !applyCode.trim()}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {applyLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Applying...
                  </>
                ) : (
                  'Apply Code'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralPage;
