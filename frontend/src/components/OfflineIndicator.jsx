import React from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWA';

/**
 * Offline Indicator Component
 * 
 * Shows a toast/banner when the user goes offline.
 * Shows a success message when connection is restored.
 */
const OfflineIndicator = () => {
    const { isOnline, wasOffline } = useOnlineStatus();
    const [dismissed, setDismissed] = React.useState(false);

    // Reset dismissed state when status changes
    React.useEffect(() => {
        if (!isOnline) {
            setDismissed(false);
        }
    }, [isOnline]);

    // Show "back online" message
    if (isOnline && wasOffline) {
        return (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
                <div className="flex items-center gap-3 bg-emerald-500 text-white px-4 py-3 rounded-2xl shadow-lg shadow-emerald-500/30">
                    <Wifi className="w-5 h-5" />
                    <span className="font-medium text-sm">You're back online!</span>
                </div>

                <style jsx>{`
                    @keyframes slide-down {
                        from {
                            opacity: 0;
                            transform: translate(-50%, -20px);
                        }
                        to {
                            opacity: 1;
                            transform: translate(-50%, 0);
                        }
                    }
                    .animate-slide-down {
                        animation: slide-down 0.3s ease-out;
                    }
                `}</style>
            </div>
        );
    }

    // Don't show if online or dismissed
    if (isOnline || dismissed) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-50">
            <div className="bg-gradient-to-r from-amber-600 to-orange-500 text-white">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                            <WifiOff className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="font-medium text-sm">You're offline</p>
                            <p className="text-white/80 text-xs">Some features may be limited</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => window.location.reload()}
                            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Retry
                        </button>
                        <button
                            onClick={() => setDismissed(true)}
                            className="text-white/70 hover:text-white px-2 py-1 text-sm transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OfflineIndicator;
