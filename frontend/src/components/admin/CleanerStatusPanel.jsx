/**
 * CleanerStatusPanel Component
 * 
 * Real-time display of cleaner availability status.
 */
import React, { useState, useEffect } from 'react';
import './CleanerStatusPanel.css';

const STATUS_COLORS = {
    available: '#22c55e',     // Green
    busy: '#f59e0b',          // Amber
    cooling_down: '#3b82f6',  // Blue
    offline: '#6b7280',       // Gray
};

const STATUS_LABELS = {
    available: 'Available',
    busy: 'Busy',
    cooling_down: 'Cooldown',
    offline: 'Offline',
};

function CleanerStatusPanel({ cleaners = [], onRefresh, loading = false }) {
    const [filter, setFilter] = useState('all');

    // Group cleaners by status
    const grouped = cleaners.reduce((acc, cleaner) => {
        const status = cleaner.status || 'offline';
        if (!acc[status]) acc[status] = [];
        acc[status].push(cleaner);
        return acc;
    }, {});

    // Count by status
    const counts = {
        available: grouped.available?.length || 0,
        busy: grouped.busy?.length || 0,
        cooling_down: grouped.cooling_down?.length || 0,
        offline: grouped.offline?.length || 0,
    };

    // Filter cleaners
    const filteredCleaners = filter === 'all'
        ? cleaners
        : cleaners.filter(c => c.status === filter);

    return (
        <div className="cleaner-status-panel">
            <div className="panel-header">
                <h3>Cleaner Status</h3>
                <button
                    className="refresh-btn"
                    onClick={onRefresh}
                    disabled={loading}
                >
                    {loading ? '⟳' : '↻'} Refresh
                </button>
            </div>

            {/* Status summary */}
            <div className="status-summary">
                {Object.entries(counts).map(([status, count]) => (
                    <button
                        key={status}
                        className={`status-pill ${filter === status ? 'active' : ''}`}
                        style={{ borderColor: STATUS_COLORS[status] }}
                        onClick={() => setFilter(filter === status ? 'all' : status)}
                    >
                        <span
                            className="status-dot"
                            style={{ backgroundColor: STATUS_COLORS[status] }}
                        />
                        <span className="status-label">{STATUS_LABELS[status]}</span>
                        <span className="status-count">{count}</span>
                    </button>
                ))}
            </div>

            {/* Cleaner list */}
            <div className="cleaner-list">
                {filteredCleaners.length === 0 ? (
                    <div className="empty-state">
                        No cleaners {filter !== 'all' ? `with "${STATUS_LABELS[filter]}" status` : 'found'}
                    </div>
                ) : (
                    filteredCleaners.map(cleaner => (
                        <div key={cleaner.user_id} className="cleaner-card">
                            <div className="cleaner-info">
                                <div className="cleaner-avatar">
                                    {cleaner.name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div className="cleaner-details">
                                    <div className="cleaner-name">{cleaner.name}</div>
                                    <div className="cleaner-stats">
                                        Jobs: {cleaner.total_jobs_completed || 0} completed
                                        {cleaner.average_rating && ` • ★ ${cleaner.average_rating}`}
                                    </div>
                                </div>
                            </div>
                            <div className="cleaner-status">
                                <span
                                    className="status-badge"
                                    style={{
                                        backgroundColor: STATUS_COLORS[cleaner.status] + '20',
                                        color: STATUS_COLORS[cleaner.status]
                                    }}
                                >
                                    {STATUS_LABELS[cleaner.status] || cleaner.status}
                                </span>
                                {cleaner.status === 'cooling_down' && cleaner.cooldown_expires_at && (
                                    <span className="cooldown-timer">
                                        Expires: {new Date(cleaner.cooldown_expires_at).toLocaleTimeString()}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default CleanerStatusPanel;
