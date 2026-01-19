import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Sparkles,
  LayoutDashboard,
  Calendar,
  Users,
  Settings,
  LogOut,
  Search,
  Filter,
  RefreshCw,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Admin Sidebar
const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Bookings', path: '/admin/bookings', icon: Calendar },
    { name: 'Customers', path: '/admin/customers', icon: Users },
    { name: 'Messages', path: '/admin/messages', icon: Mail },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside className="admin-sidebar p-6 flex flex-col">
      <Link to="/" className="flex items-center gap-2 mb-10">
        <div className="w-10 h-10 rounded-xl bg-lime-500 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="font-heading font-bold text-xl">BrightHome</span>
      </Link>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`admin-nav-item ${location.pathname === item.path ? 'active' : ''}`}
            data-testid={`admin-nav-${item.name.toLowerCase()}`}
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </Link>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        className="admin-nav-item text-green-300 hover:text-white mt-auto"
        data-testid="admin-logout"
      >
        <LogOut className="w-5 h-5" />
        Logout
      </button>
    </aside>
  );
};

// Dashboard Overview
const DashboardOverview = () => {
  const { getAuthHeaders } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, bookingsRes] = await Promise.all([
          axios.get(`${API}/admin/stats`, { headers: getAuthHeaders() }),
          axios.get(`${API}/admin/bookings`, { headers: getAuthHeaders() })
        ]);
        setStats(statsRes.data);
        setRecentBookings(bookingsRes.data.slice(0, 5));
      } catch (error) {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [getAuthHeaders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-green-900" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Bookings', value: stats?.total_bookings || 0, icon: Calendar, color: 'bg-blue-100 text-blue-600' },
    { label: 'Pending', value: stats?.pending_bookings || 0, icon: Clock, color: 'bg-amber-100 text-amber-600' },
    { label: 'Completed', value: stats?.completed_bookings || 0, icon: CheckCircle, color: 'bg-green-100 text-green-600' },
    { label: 'Total Revenue', value: `$${(stats?.total_revenue || 0).toFixed(0)}`, icon: DollarSign, color: 'bg-lime-100 text-lime-600' },
    { label: 'Customers', value: stats?.total_customers || 0, icon: Users, color: 'bg-purple-100 text-purple-600' },
  ];

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-green-900 mb-6">Dashboard Overview</h1>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map((stat, index) => (
          <div key={index} className="stats-card">
            <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-stone-500 text-sm">{stat.label}</p>
            <p className="font-heading text-2xl font-bold text-green-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Bookings */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="p-6 border-b border-stone-200">
          <h2 className="font-heading text-lg font-semibold text-green-900">Recent Bookings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Service</th>
                <th>Date</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((booking) => (
                <tr key={booking.id}>
                  <td>
                    <div>
                      <p className="font-medium text-green-900">{booking.user_name}</p>
                      <p className="text-stone-500 text-xs">{booking.user_email}</p>
                    </div>
                  </td>
                  <td>{booking.service_name}</td>
                  <td>{booking.scheduled_date}</td>
                  <td>
                    <span className={`badge badge-${booking.status}`}>
                      {booking.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="font-semibold">${booking.total_price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Bookings Management
const BookingsManagement = () => {
  const { getAuthHeaders } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const response = await axios.get(`${API}/admin/bookings`, {
        headers: getAuthHeaders(),
        params
      });
      setBookings(response.data);
    } catch (error) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  const updateStatus = async (bookingId, newStatus) => {
    try {
      await axios.put(`${API}/admin/bookings/${bookingId}/status?status=${newStatus}`, {}, {
        headers: getAuthHeaders()
      });
      toast.success('Status updated');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const filteredBookings = bookings.filter(b =>
    b.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.service_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="font-heading text-2xl font-bold text-green-900">Bookings</h1>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              placeholder="Search bookings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
              data-testid="bookings-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="bookings-filter">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-green-900" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Location</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} data-testid={`admin-booking-${booking.id}`}>
                    <td>
                      <div>
                        <p className="font-medium text-green-900">{booking.user_name}</p>
                        <p className="text-stone-500 text-xs">{booking.user_email}</p>
                      </div>
                    </td>
                    <td>{booking.service_name}</td>
                    <td>
                      <div className="text-sm">
                        <p>{booking.city}</p>
                        <p className="text-stone-500 text-xs">{booking.property_size} sqft</p>
                      </div>
                    </td>
                    <td>
                      <div className="text-sm">
                        <p>{booking.scheduled_date}</p>
                        <p className="text-stone-500">{booking.scheduled_time}</p>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${booking.status}`}>
                        {booking.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${booking.payment_status === 'paid' ? 'badge-paid' : 'badge-pending'}`}>
                        {booking.payment_status}
                      </span>
                    </td>
                    <td className="font-semibold">${booking.total_price.toFixed(2)}</td>
                    <td>
                      <Select
                        value={booking.status}
                        onValueChange={(value) => updateStatus(booking.id, value)}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs" data-testid={`status-select-${booking.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// Customers Management
const CustomersManagement = () => {
  const { getAuthHeaders } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await axios.get(`${API}/admin/customers`, {
          headers: getAuthHeaders()
        });
        setCustomers(response.data);
      } catch (error) {
        toast.error('Failed to load customers');
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, [getAuthHeaders]);

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="font-heading text-2xl font-bold text-green-900">Customers</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 w-64"
            data-testid="customers-search"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-green-900" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Bookings</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} data-testid={`customer-${customer.id}`}>
                    <td className="font-medium text-green-900">{customer.name}</td>
                    <td>
                      <div className="flex items-center gap-2 text-stone-600">
                        <Mail className="w-4 h-4" />
                        {customer.email}
                      </div>
                    </td>
                    <td>
                      {customer.phone ? (
                        <div className="flex items-center gap-2 text-stone-600">
                          <Phone className="w-4 h-4" />
                          {customer.phone}
                        </div>
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>
                    <td>
                      <span className="px-3 py-1 rounded-full bg-lime-100 text-lime-700 text-sm font-medium">
                        {customer.booking_count} bookings
                      </span>
                    </td>
                    <td className="text-stone-500 text-sm">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// Messages Management
const MessagesManagement = () => {
  const { getAuthHeaders } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await axios.get(`${API}/admin/contacts`, {
          headers: getAuthHeaders()
        });
        setMessages(response.data);
      } catch (error) {
        toast.error('Failed to load messages');
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [getAuthHeaders]);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-green-900 mb-6">Contact Messages</h1>

      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-green-900" />
          </div>
        ) : messages.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
            <Mail className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-600">No messages yet</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="bg-white rounded-2xl border border-stone-200 p-6" data-testid={`message-${message.id}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-heading font-semibold text-green-900">{message.subject}</h3>
                  <p className="text-stone-500 text-sm">
                    From: {message.name} ({message.email})
                  </p>
                </div>
                <span className="text-stone-400 text-sm">
                  {new Date(message.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-stone-600">{message.message}</p>
              {message.phone && (
                <p className="text-stone-500 text-sm mt-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  {message.phone}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Main Admin Dashboard
const AdminDashboard = () => {
  return (
    <div className="min-h-screen bg-stone-50 flex">
      <AdminSidebar />
      <main className="flex-1 ml-64 p-8">
        <Routes>
          <Route index element={<DashboardOverview />} />
          <Route path="bookings" element={<BookingsManagement />} />
          <Route path="customers" element={<CustomersManagement />} />
          <Route path="messages" element={<MessagesManagement />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminDashboard;
