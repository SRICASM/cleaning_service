import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import {
    LogOut,
    MapPin,
    Clock,
    Calendar,
    CheckCircle,
    XCircle,
    Navigation,
    Phone,
    User,
    Power,
    Wifi,
    WifiOff
} from 'lucide-react';
import './CleanerDashboard.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CleanerDashboard = () => {
    const { user, token, logout, getAuthHeaders } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [cleanerStatus, setCleanerStatus] = useState('offline');
    const [jobs, setJobs] = useState([]);

    // Fetch dashboard data
    const fetchData = useCallback(async () => {
        try {
            const [statusRes, jobsRes] = await Promise.all([
                axios.get(`${API}/cleaner/status`, { headers: getAuthHeaders() }),
                axios.get(`${API}/cleaner/jobs/today`, { headers: getAuthHeaders() })
            ]);

            setCleanerStatus(statusRes.data.status);
            setJobs(jobsRes.data.jobs);
        } catch (err) {
            console.error('Failed to fetch dashboard data', err);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    // WebSocket for real-time updates
    const { isConnected } = useWebSocket('/api/ws/cleaner', {
        token,
        autoConnect: !!user,
        autoReconnect: true,
        onMessage: (data) => {
            console.log('Cleaner WebSocket message:', data);

            // Handle job assignment events
            if (data.type === 'job.assigned') {
                toast.success('New job assigned to you!');
                fetchData();
            } else if (data.type === 'job.cancelled') {
                toast.warning('A job was cancelled');
                fetchData();
            } else if (data.type === 'job.started' || data.type === 'job.completed') {
                fetchData();
            }
        },
        onConnect: () => {
            console.log('Cleaner WebSocket connected');
        }
    });

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user, fetchData]);

    const handleStatusToggle = async () => {
        const newStatus = cleanerStatus === 'available' ? 'offline' : 'available';
        try {
            await axios.put(
                `${API}/cleaner/status`,
                { status: newStatus },
                { headers: getAuthHeaders() }
            );
            setCleanerStatus(newStatus);
            toast.success(`You are now ${newStatus}`);
        } catch (err) {
            toast.error('Failed to update status');
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/cleaner/login');
    };

    if (!user) return null;

    return (
        <div className="cleaner-dashboard">
            {/* Heavy Header for Mobile */}
            <header className="cleaner-header">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-lime-100 flex items-center justify-center text-lime-700 font-bold text-lg">
                        {user.full_name?.charAt(0)}
                    </div>
                    <div>
                        <h1 className="font-bold text-stone-900 leading-tight">Hello, {user.full_name?.split(' ')[0]}</h1>
                        <p className="text-xs text-stone-500">{user.employee_id}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isConnected ? (
                        <Wifi className="w-4 h-4 text-green-500" />
                    ) : (
                        <WifiOff className="w-4 h-4 text-red-400" />
                    )}
                    <button onClick={handleLogout} className="text-stone-400 hover:text-stone-600">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Status Toggle Card */}
            <div className={`status-card ${cleanerStatus}`}>
                <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-white opacity-90">Current Status</span>
                    <div className="status-indicator">
                        <span className="animate-pulse w-2 h-2 rounded-full bg-white"></span>
                        {cleanerStatus.toUpperCase()}
                    </div>
                </div>
                <button
                    onClick={handleStatusToggle}
                    className="w-full bg-white/20 hover:bg-white/30 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                    <Power className="w-5 h-5" />
                    {cleanerStatus === 'available' ? 'Go Offline' : 'Go Online'}
                </button>
            </div>

            {/* Today's Jobs */}
            <div className="mt-6">
                <h2 className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-lime-600" />
                    Today's Jobs
                </h2>

                {loading ? (
                    <div className="text-center py-8 text-stone-400">Loading jobs...</div>
                ) : jobs.length === 0 ? (
                    <div className="empty-jobs">
                        <CheckCircle className="w-12 h-12 text-stone-300 mb-2" />
                        <p className="text-stone-500">No jobs assigned for today</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {jobs.map(job => (
                            <JobCard key={job.id} job={job} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const JobCard = ({ job }) => {
    return (
        <div className="job-card">
            <div className="job-header">
                <span className="job-time">
                    <Clock className="w-4 h-4" />
                    {job.start_time} - {job.end_time}
                </span>
                <span className={`job-status status-${job.status.toLowerCase()}`}>
                    {job.status}
                </span>
            </div>

            <div className="job-body">
                <h3 className="job-customer">{job.customer_name}</h3>
                <div className="job-detail">
                    <MapPin className="w-4 h-4 text-stone-400" />
                    <span className="text-sm text-stone-600">{job.address}</span>
                </div>
                <div className="job-detail">
                    <Phone className="w-4 h-4 text-stone-400" />
                    <a href={`tel:${job.customer_phone}`} className="text-sm text-blue-600 hover:underline">
                        {job.customer_phone}
                    </a>
                </div>
            </div>

            <div className="job-actions">
                <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(`https://maps.google.com/?q=${job.address}`, '_blank')}
                >
                    <Navigation className="w-4 h-4 mr-2" />
                    Navigate
                </Button>
                <Button className="flex-1 bg-lime-600 hover:bg-lime-700">
                    View Details
                </Button>
            </div>
        </div>
    );
};

export default CleanerDashboard;
