/**
 * DashboardStats Component
 * 
 * Real-time dashboard statistics display.
 */
import React from 'react';
import './DashboardStats.css';

function DashboardStats({ stats = {}, loading = false }) {
    const statCards = [
        {
            key: 'active_jobs_count',
            label: 'Active Jobs',
            icon: '🔄',
            color: '#3b82f6',
            bgColor: '#eff6ff',
        },
        {
            key: 'available_cleaners_count',
            label: 'Available Cleaners',
            icon: '✓',
            color: '#22c55e',
            bgColor: '#f0fdf4',
        },
        {
            key: 'busy_cleaners_count',
            label: 'Busy Cleaners',
            icon: '👤',
            color: '#f59e0b',
            bgColor: '#fffbeb',
        },
        {
            key: 'delayed_jobs_count',
            label: 'Delayed Jobs',
            icon: '⚠',
            color: '#ef4444',
            bgColor: '#fef2f2',
        },
        {
            key: 'pending_assignment_count',
            label: 'Pending Assignment',
            icon: '⏳',
            color: '#8b5cf6',
            bgColor: '#f5f3ff',
        },
        {
            key: 'completed_today_count',
            label: 'Completed Today',
            icon: '✅',
            color: '#10b981',
            bgColor: '#ecfdf5',
        },
    ];

    return (
        <div className="dashboard-stats">
            {statCards.map(card => (
                <div
                    key={card.key}
                    className={`stat-card ${loading ? 'loading' : ''}`}
                    style={{ borderColor: card.color }}
                >
                    <div
                        className="stat-icon"
                        style={{ backgroundColor: card.bgColor, color: card.color }}
                    >
                        {card.icon}
                    </div>
                    <div className="stat-content">
                        <div className="stat-value" style={{ color: card.color }}>
                            {loading ? '...' : (stats[card.key] || 0)}
                        </div>
                        <div className="stat-label">{card.label}</div>
                    </div>
                </div>
            ))}

            {/* Revenue card */}
            <div className={`stat-card revenue ${loading ? 'loading' : ''}`}>
                <div
                    className="stat-icon"
                    style={{ backgroundColor: '#fdf2f8', color: '#ec4899' }}
                >
                    💰
                </div>
                <div className="stat-content">
                    <div className="stat-value" style={{ color: '#ec4899' }}>
                        ${loading ? '...' : (stats.revenue_today?.toFixed(2) || '0.00')}
                    </div>
                    <div className="stat-label">Revenue Today</div>
                </div>
            </div>
        </div>
    );
}

export default DashboardStats;
