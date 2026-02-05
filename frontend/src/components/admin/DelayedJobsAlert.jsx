/**
 * DelayedJobsAlert Component
 * 
 * Shows SLA breach alerts for jobs that are delayed.
 */
import React, { useState, useEffect } from 'react';
import './DelayedJobsAlert.css';

function DelayedJobsAlert({
    delayedJobs = [],
    onRefresh,
    onJobClick,
    loading = false,
    autoRefresh = true,
    refreshInterval = 30000 // 30 seconds
}) {
    const [lastUpdate, setLastUpdate] = useState(new Date());

    // Auto-refresh
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            onRefresh?.();
            setLastUpdate(new Date());
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, onRefresh]);

    // Sort by delay (most delayed first)
    const sortedJobs = [...delayedJobs].sort((a, b) => b.delay_minutes - a.delay_minutes);

    // Calculate severity
    const getSeverity = (delayMinutes) => {
        if (delayMinutes >= 30) return 'critical';
        if (delayMinutes >= 15) return 'high';
        if (delayMinutes >= 5) return 'medium';
        return 'low';
    };

    if (sortedJobs.length === 0) {
        return (
            <div className="delayed-jobs-alert no-alerts">
                <div className="no-alerts-content">
                    <span className="check-icon">✓</span>
                    <span>All jobs on track</span>
                </div>
                <span className="last-update">
                    Updated {lastUpdate.toLocaleTimeString()}
                </span>
            </div>
        );
    }

    return (
        <div className="delayed-jobs-alert has-alerts">
            <div className="alert-header">
                <div className="alert-title">
                    <span className="warning-icon">⚠</span>
                    <span>SLA Alerts</span>
                    <span className="alert-count">{sortedJobs.length}</span>
                </div>
                <div className="alert-actions">
                    <span className="last-update">
                        {lastUpdate.toLocaleTimeString()}
                    </span>
                    <button
                        className="refresh-btn"
                        onClick={onRefresh}
                        disabled={loading}
                    >
                        ↻
                    </button>
                </div>
            </div>

            <div className="alert-list">
                {sortedJobs.map(job => {
                    const severity = getSeverity(job.delay_minutes);
                    return (
                        <div
                            key={job.id}
                            className={`alert-item severity-${severity}`}
                            onClick={() => onJobClick?.(job)}
                        >
                            <div className="alert-main">
                                <div className="job-info">
                                    <span className="booking-number">{job.booking_number}</span>
                                    <span className="job-status">{job.status}</span>
                                </div>
                                <div className="delay-badge">
                                    {job.delay_minutes}m late
                                </div>
                            </div>
                            <div className="alert-details">
                                {job.cleaner_name ? (
                                    <span className="cleaner">👤 {job.cleaner_name}</span>
                                ) : (
                                    <span className="no-cleaner">⚠ No cleaner assigned</span>
                                )}
                                <span className="customer">{job.customer_name}</span>
                                <span className="city">{job.city}</span>
                            </div>
                            <div className="scheduled-time">
                                Scheduled: {new Date(job.scheduled_date).toLocaleString()}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default DelayedJobsAlert;
