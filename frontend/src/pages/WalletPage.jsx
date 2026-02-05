import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, ArrowUpCircle, ArrowDownCircle, Gift, RefreshCw,
  TrendingUp, Clock, ChevronRight, Plus, History, Sparkles,
  CreditCard, ArrowLeft, Filter, Calendar
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WalletPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [walletData, setWalletData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [transactionPage, setTransactionPage] = useState(1);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [filterType, setFilterType] = useState('all');
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchWalletData();
      fetchTransactions();
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchTransactions();
    }
  }, [filterType, transactionPage]);

  const fetchWalletData = async () => {
    try {
      const response = await fetch(`${API}/wallet/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWalletData(data);
      }
    } catch (error) {
      console.error('Error fetching wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const typeParam = filterType !== 'all' ? `&type=${filterType}` : '';
      const response = await fetch(
        `${API}/wallet/transactions?page=${transactionPage}&page_size=10${typeParam}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        if (transactionPage === 1) {
          setTransactions(data.transactions);
        } else {
          setTransactions(prev => [...prev, ...data.transactions]);
        }
        setHasMoreTransactions(data.has_more);
        setTotalTransactions(data.total);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0 || amount > 10000) {
      alert('Please enter a valid amount (1-10,000 AED)');
      return;
    }

    setTopUpLoading(true);
    try {
      const response = await fetch(`${API}/wallet/topup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount })
      });

      if (response.ok) {
        const data = await response.json();
        setShowTopUpModal(false);
        setTopUpAmount('');
        // Refresh wallet data
        fetchWalletData();
        setTransactionPage(1);
        fetchTransactions();
        alert(data.message);
      } else {
        const error = await response.json();
        alert(error.detail || 'Top-up failed');
      }
    } catch (error) {
      console.error('Top-up error:', error);
      alert('Failed to top up wallet');
    } finally {
      setTopUpLoading(false);
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'credit':
      case 'topup':
        return <ArrowDownCircle className="w-5 h-5 text-emerald-500" />;
      case 'debit':
      case 'withdrawal':
        return <ArrowUpCircle className="w-5 h-5 text-red-500" />;
      case 'cashback':
        return <Gift className="w-5 h-5 text-purple-500" />;
      case 'referral':
        return <Sparkles className="w-5 h-5 text-amber-500" />;
      case 'refund':
        return <RefreshCw className="w-5 h-5 text-blue-500" />;
      default:
        return <Wallet className="w-5 h-5 text-stone-500" />;
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'credit':
      case 'topup':
      case 'cashback':
      case 'referral':
      case 'refund':
        return 'text-emerald-600';
      case 'debit':
      case 'withdrawal':
        return 'text-red-600';
      default:
        return 'text-stone-600';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const quickTopUpAmounts = [50, 100, 200, 500];

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

        {/* Wallet Balance Card */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white shadow-lg mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-emerald-100 text-sm">Available Balance</p>
                <p className="text-3xl font-bold">AED {walletData?.balance?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
            <button
              onClick={() => setShowTopUpModal(true)}
              className="bg-white text-emerald-600 px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-emerald-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Top Up
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-emerald-100 text-xs">This Month Credits</p>
              <p className="text-lg font-semibold">+AED {walletData?.monthly_credits?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-emerald-100 text-xs">This Month Debits</p>
              <p className="text-lg font-semibold">-AED {walletData?.monthly_debits?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-emerald-100 text-xs">Total Cashback</p>
              <p className="text-lg font-semibold">AED {walletData?.total_cashback?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <button
            onClick={() => navigate('/referrals')}
            className="bg-white rounded-xl p-4 border border-stone-200 hover:border-emerald-300 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
            </div>
            <p className="font-semibold text-green-900 text-sm">Refer & Earn</p>
            <p className="text-xs text-stone-500">AED 50 per referral</p>
          </button>

          <button
            onClick={() => navigate('/services')}
            className="bg-white rounded-xl p-4 border border-stone-200 hover:border-emerald-300 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="font-semibold text-green-900 text-sm">Pay with Wallet</p>
            <p className="text-xs text-stone-500">Use balance at checkout</p>
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="bg-white rounded-xl p-4 border border-stone-200 hover:border-emerald-300 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
              <Gift className="w-5 h-5 text-purple-600" />
            </div>
            <p className="font-semibold text-green-900 text-sm">Cashback</p>
            <p className="text-xs text-stone-500">Earn on every booking</p>
          </button>

          <button
            onClick={() => setFilterType('all')}
            className="bg-white rounded-xl p-4 border border-stone-200 hover:border-emerald-300 hover:shadow-md transition-all text-left"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
              <History className="w-5 h-5 text-blue-600" />
            </div>
            <p className="font-semibold text-green-900 text-sm">History</p>
            <p className="text-xs text-stone-500">{totalTransactions} transactions</p>
          </button>
        </div>

        {/* Referral Earnings Banner */}
        {walletData?.total_referral_earnings > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-amber-800">Referral Earnings</p>
                  <p className="text-sm text-amber-600">You've earned AED {walletData.total_referral_earnings.toFixed(2)} from referrals!</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/referrals')}
                className="text-amber-600 hover:text-amber-700"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-green-900">Transaction History</h2>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-stone-400" />
                <select
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value);
                    setTransactionPage(1);
                  }}
                  className="text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Types</option>
                  <option value="credit">Credits</option>
                  <option value="debit">Debits</option>
                  <option value="topup">Top-ups</option>
                  <option value="cashback">Cashback</option>
                  <option value="referral">Referral</option>
                  <option value="refund">Refunds</option>
                </select>
              </div>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-stone-400" />
              </div>
              <p className="text-stone-600 font-medium">No transactions yet</p>
              <p className="text-sm text-stone-500 mt-1">Your wallet transactions will appear here</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-stone-100">
                {transactions.map((tx) => (
                  <div key={tx.id} className="p-4 hover:bg-stone-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center">
                          {getTransactionIcon(tx.type)}
                        </div>
                        <div>
                          <p className="font-medium text-green-900">{tx.description}</p>
                          <p className="text-xs text-stone-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(tx.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${getTransactionColor(tx.type)}`}>
                          {['debit', 'withdrawal'].includes(tx.type) ? '-' : '+'}AED {tx.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-stone-500">
                          Balance: AED {tx.balance_after.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {hasMoreTransactions && (
                <div className="p-4 border-t border-stone-200">
                  <button
                    onClick={() => setTransactionPage(prev => prev + 1)}
                    className="w-full py-2 text-emerald-600 hover:text-emerald-700 font-medium text-sm"
                  >
                    Load More Transactions
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />

      {/* Top Up Modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-green-900 mb-4">Top Up Wallet</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Enter Amount (AED)
              </label>
              <input
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="Enter amount"
                min="1"
                max="10000"
                className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg"
              />
            </div>

            <div className="mb-6">
              <p className="text-sm text-stone-500 mb-2">Quick amounts</p>
              <div className="grid grid-cols-4 gap-2">
                {quickTopUpAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setTopUpAmount(amount.toString())}
                    className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                      topUpAmount === amount.toString()
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                        : 'border-stone-200 text-stone-600 hover:border-emerald-300'
                    }`}
                  >
                    AED {amount}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 rounded-lg p-3 mb-6">
              <p className="text-sm text-amber-700">
                <strong>Note:</strong> This is a test mode. In production, you'll be redirected to a secure payment gateway.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTopUpModal(false);
                  setTopUpAmount('');
                }}
                className="flex-1 py-3 border border-stone-300 rounded-xl font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTopUp}
                disabled={topUpLoading || !topUpAmount}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {topUpLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Add AED {topUpAmount || '0'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletPage;
