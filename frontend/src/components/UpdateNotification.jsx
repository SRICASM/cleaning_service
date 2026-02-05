import React, { useState, useEffect } from 'react';
import { RefreshCw, X, Download, Sparkles } from 'lucide-react';

/**
 * PWA Update Notification Component
 * 
 * Shows a toast when a new service worker version is available.
 * Allows users to refresh to get the latest version.
 */
const UpdateNotification = () => {
    const [showUpdate, setShowUpdate] = useState(false);
    const [waitingWorker, setWaitingWorker] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        // Listen for service worker updates
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                // Check if there's already a waiting worker
                if (registration.waiting) {
                    setWaitingWorker(registration.waiting);
                    setShowUpdate(true);
                }

                // Listen for new workers
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New content is available
                            setWaitingWorker(newWorker);
                            setShowUpdate(true);
                        }
                    });
                });
            });

            // Handle controller change (when new SW takes over)
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshing) {
                    refreshing = true;
                    window.location.reload();
                }
            });
        }
    }, []);

    const handleUpdate = () => {
        if (waitingWorker) {
            setIsUpdating(true);
            // Tell the waiting worker to skip waiting and activate
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        }
    };

    const handleDismiss = () => {
        setShowUpdate(false);
    };

    if (!showUpdate) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
            <div className="bg-gradient-to-r from-emerald-900/95 to-emerald-800/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-emerald-600/30 overflow-hidden">
                {/* Animated gradient border */}
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-400 opacity-20 animate-gradient-x" />

                <div className="relative p-4">
                    <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="flex-shrink-0 w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <h4 className="text-white font-semibold text-sm mb-1">
                                New Version Available!
                            </h4>
                            <p className="text-emerald-200/80 text-xs leading-relaxed">
                                A new version of CleanUpCrew is ready. Update now for the best experience.
                            </p>
                        </div>

                        {/* Close button */}
                        <button
                            onClick={handleDismiss}
                            className="flex-shrink-0 p-1 text-emerald-300/60 hover:text-white transition-colors"
                            aria-label="Dismiss"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4">
                        <button
                            onClick={handleUpdate}
                            disabled={isUpdating}
                            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-600 text-white font-medium py-2.5 px-4 rounded-xl transition-all duration-200 text-sm shadow-lg shadow-emerald-500/25"
                        >
                            {isUpdating ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    Update Now
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="px-4 py-2.5 text-emerald-300 hover:text-white font-medium text-sm transition-colors"
                        >
                            Later
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes slide-up {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes gradient-x {
                    0%, 100% {
                        background-position: 0% 50%;
                    }
                    50% {
                        background-position: 100% 50%;
                    }
                }

                .animate-slide-up {
                    animation: slide-up 0.4s ease-out;
                }

                .animate-gradient-x {
                    background-size: 200% 200%;
                    animation: gradient-x 3s ease infinite;
                }
            `}</style>
        </div>
    );
};

export default UpdateNotification;
