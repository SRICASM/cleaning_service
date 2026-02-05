import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import {
    UserPlus,
    Search,
    RefreshCw,
    Phone,
    MapPin,
    Star,
    CheckCircle,
    XCircle,
    AlertCircle,
    Briefcase,
    Eye,
    Edit2,
    UserX,
    X
} from 'lucide-react';
import './EmployeeManagement.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Region options for UAE
const REGIONS = [
    { value: 'DXB', label: 'Dubai' },
    { value: 'AUH', label: 'Abu Dhabi' },
    { value: 'SHJ', label: 'Sharjah' },
    { value: 'AJM', label: 'Ajman' },
    { value: 'RAK', label: 'Ras Al Khaimah' },
    { value: 'FUJ', label: 'Fujairah' },
    { value: 'UAQ', label: 'Umm Al Quwain' },
];

// Status badge component
const StatusBadge = ({ status }) => {
    const config = {
        active: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
        suspended: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertCircle },
        terminated: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
    };

    const { bg, text, icon: Icon } = config[status] || config.active;

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
            <Icon className="w-3 h-3" />
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
};

// Create Employee Modal
const CreateEmployeeModal = ({ isOpen, onClose, onSuccess, getAuthHeaders }) => {
    const [formData, setFormData] = useState({
        phone_number: '',
        full_name: '',
        email: '',
        region_code: '',
    });
    const [loading, setLoading] = useState(false);
    const [previewId, setPreviewId] = useState('');

    // Fetch preview ID when region changes
    useEffect(() => {
        const fetchPreviewId = async () => {
            if (!formData.region_code) {
                setPreviewId('');
                return;
            }

            try {
                const res = await axios.get(
                    `${API}/admin/employees/preview/preview-next-id?region_code=${formData.region_code}`,
                    { headers: getAuthHeaders() }
                );
                setPreviewId(res.data.next_employee_id);
            } catch (err) {
                console.error('Failed to fetch preview ID');
            }
        };

        fetchPreviewId();
    }, [formData.region_code, getAuthHeaders]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await axios.post(
                `${API}/admin/employees`,
                formData,
                { headers: getAuthHeaders() }
            );

            toast.success(`Employee created! ID: ${res.data.employee_id}`);
            onSuccess(res.data);
            onClose();
            setFormData({ phone_number: '', full_name: '', email: '', region_code: '' });
        } catch (err) {
            console.error('Employee creation error:', err.response?.data || err.message);

            // Handle Pydantic validation errors (array of objects) vs simple string errors
            const detail = err.response?.data?.detail;
            let message = 'Failed to create employee';

            if (Array.isArray(detail)) {
                // Pydantic validation error - extract messages
                message = detail.map(e => e.msg || e.message).join(', ');
            } else if (typeof detail === 'string') {
                message = detail;
            } else if (err.response?.data?.message) {
                message = err.response.data.message;
            } else if (err.message) {
                message = err.message;
            }

            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="text-xl font-heading font-bold text-green-900">
                        Add New Cleaner
                    </h2>
                    <button onClick={onClose} className="modal-close">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    {previewId && (
                        <div className="preview-id-box">
                            <span className="text-sm text-stone-500">Employee ID Preview:</span>
                            <span className="text-lg font-mono font-bold text-green-600">{previewId}</span>
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="phone_number" className="form-label">
                            Phone Number <span className="text-red-500">*</span>
                        </label>
                        <div className="phone-input-wrapper">
                            <span className="phone-prefix">+971</span>
                            <Input
                                id="phone_number"
                                type="tel"
                                placeholder="501234567"
                                value={formData.phone_number.replace('+971', '')}
                                onChange={(e) => {
                                    const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                                    setFormData({ ...formData, phone_number: `+971${digits}` });
                                }}
                                className="phone-input"
                                required
                            />
                        </div>
                        <p className="form-hint">This number will be used for login</p>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-2 border border-blue-100 mb-4">
                        <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-600">
                            A default password (cleaner123) will be set and sent via SMS.
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="full_name" className="form-label">
                            Full Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                            id="full_name"
                            type="text"
                            placeholder="Enter employee's full name"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="region_code" className="form-label">
                            Region <span className="text-red-500">*</span>
                        </label>
                        <Select
                            value={formData.region_code}
                            onValueChange={(value) => setFormData({ ...formData, region_code: value })}
                        >
                            <SelectTrigger id="region_code">
                                <SelectValue placeholder="Select region" />
                            </SelectTrigger>
                            <SelectContent position="popper" className="z-[99999]">
                                {REGIONS.map((region) => (
                                    <SelectItem key={region.value} value={region.value}>
                                        {region.label} ({region.value})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="modal-footer">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !formData.phone_number || !formData.full_name || !formData.region_code}
                            className="bg-lime-500 hover:bg-lime-600"
                        >
                            {loading ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Create Employee
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Employee Card
const EmployeeCard = ({ employee, onUpdate }) => {
    const regionLabel = REGIONS.find(r => r.value === employee.region_code)?.label || employee.region_code;

    return (
        <div className="employee-card">
            <div className="employee-card-header">
                <div className="employee-avatar">
                    {employee.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="employee-info">
                    <h3 className="employee-name">{employee.full_name}</h3>
                    <p className="employee-id">{employee.employee_id}</p>
                </div>
                <StatusBadge status={employee.account_status} />
            </div>

            <div className="employee-card-body">
                <div className="employee-detail">
                    <Phone className="w-4 h-4 text-stone-400" />
                    <span>{employee.phone_number}</span>
                </div>
                <div className="employee-detail">
                    <MapPin className="w-4 h-4 text-stone-400" />
                    <span>{regionLabel}</span>
                </div>
                <div className="employee-detail">
                    <Briefcase className="w-4 h-4 text-stone-400" />
                    <span>{employee.total_jobs_completed} jobs completed</span>
                </div>
                <div className="employee-detail">
                    <Star className="w-4 h-4 text-amber-400" />
                    <span>{employee.rating.toFixed(1)} rating</span>
                </div>
            </div>

            <div className="employee-card-footer">
                <span className="text-xs text-stone-400">
                    {employee.last_login_at
                        ? `Last login: ${new Date(employee.last_login_at).toLocaleDateString()}`
                        : 'Never logged in'
                    }
                </span>
                <div className="employee-actions">
                    <button className="action-btn" title="View Details">
                        <Eye className="w-4 h-4" />
                    </button>
                    <button className="action-btn" title="Edit">
                        <Edit2 className="w-4 h-4" />
                    </button>
                    {employee.account_status === 'active' && (
                        <button className="action-btn text-red-500" title="Suspend">
                            <UserX className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// Main Employee Management Component
const EmployeeManagement = () => {
    const { getAuthHeaders } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [regionFilter, setRegionFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        suspended: 0,
        terminated: 0,
    });

    const fetchEmployees = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (regionFilter !== 'all') params.append('region_code', regionFilter);
            if (statusFilter !== 'all') params.append('status', statusFilter);

            const res = await axios.get(
                `${API}/admin/employees?${params.toString()}`,
                { headers: getAuthHeaders() }
            );

            setEmployees(res.data.employees);

            // Calculate stats
            const all = res.data.employees;
            setStats({
                total: res.data.total,
                active: all.filter(e => e.account_status === 'active').length,
                suspended: all.filter(e => e.account_status === 'suspended').length,
                terminated: all.filter(e => e.account_status === 'terminated').length,
            });
        } catch (err) {
            toast.error('Failed to fetch employees');
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders, searchQuery, regionFilter, statusFilter]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    const handleEmployeeCreated = (newEmployee) => {
        setEmployees([newEmployee, ...employees]);
        fetchEmployees(); // Refresh to get updated stats
    };

    return (
        <div className="employee-management">
            {/* Header */}
            <div className="employee-header">
                <div>
                    <h1 className="text-2xl font-heading font-bold text-green-900">
                        Employee Management
                    </h1>
                    <p className="text-stone-500 mt-1">
                        Manage your cleaning staff and their profiles
                    </p>
                </div>
                <Button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-lime-500 hover:bg-lime-600"
                >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add New Cleaner
                </Button>
            </div>

            {/* Stats */}
            <div className="employee-stats">
                <div className="stat-card">
                    <div className="stat-icon bg-blue-100">
                        <Briefcase className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.total}</span>
                        <span className="stat-label">Total Employees</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon bg-emerald-100">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.active}</span>
                        <span className="stat-label">Active</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon bg-amber-100">
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.suspended}</span>
                        <span className="stat-label">Suspended</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon bg-red-100">
                        <XCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.terminated}</span>
                        <span className="stat-label">Terminated</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="employee-filters">
                <div className="search-box">
                    <Search className="w-4 h-4 text-stone-400" />
                    <Input
                        type="text"
                        placeholder="Search by name, phone, or ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>

                <Select value={regionFilter} onValueChange={setRegionFilter}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Region" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Regions</SelectItem>
                        {REGIONS.map((region) => (
                            <SelectItem key={region.value} value={region.value}>
                                {region.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                    </SelectContent>
                </Select>

                <Button variant="outline" onClick={fetchEmployees}>
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* Employee Grid */}
            {loading ? (
                <div className="loading-state">
                    <RefreshCw className="w-8 h-8 animate-spin text-lime-500" />
                    <p className="text-stone-500 mt-2">Loading employees...</p>
                </div>
            ) : employees.length === 0 ? (
                <div className="empty-state">
                    <UserPlus className="w-12 h-12 text-stone-300" />
                    <h3 className="text-lg font-medium text-stone-600 mt-4">No employees found</h3>
                    <p className="text-stone-400 mt-1">
                        {searchQuery || regionFilter !== 'all' || statusFilter !== 'all'
                            ? 'Try adjusting your filters'
                            : 'Add your first cleaner to get started'
                        }
                    </p>
                    {!searchQuery && regionFilter === 'all' && statusFilter === 'all' && (
                        <Button
                            onClick={() => setShowCreateModal(true)}
                            className="mt-4 bg-lime-500 hover:bg-lime-600"
                        >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Add First Cleaner
                        </Button>
                    )}
                </div>
            ) : (
                <div className="employee-grid">
                    {employees.map((employee) => (
                        <EmployeeCard
                            key={employee.id}
                            employee={employee}
                            onUpdate={fetchEmployees}
                        />
                    ))}
                </div>
            )}

            {/* Create Modal */}
            <CreateEmployeeModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={handleEmployeeCreated}
                getAuthHeaders={getAuthHeaders}
            />
        </div>
    );
};

export default EmployeeManagement;
