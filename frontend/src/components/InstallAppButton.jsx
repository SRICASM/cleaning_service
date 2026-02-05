import React from 'react';
import { Download, Check, Smartphone } from 'lucide-react';
import { useInstallPrompt } from '../hooks/usePWA';

/**
 * Install App Button Component
 * 
 * Shows an install button when PWA installation is available.
 * Hides automatically when app is already installed.
 */
const InstallAppButton = ({
    variant = 'default', // 'default', 'banner', 'floating'
    className = ''
}) => {
    const { canInstall, promptInstall, isInstalled } = useInstallPrompt();
    const [installing, setInstalling] = React.useState(false);
    const [showSuccess, setShowSuccess] = React.useState(false);

    const handleInstall = async () => {
        setInstalling(true);
        const success = await promptInstall();
        setInstalling(false);

        if (success) {
            setShowSuccess(true);
        }
    };

    // Don't render if can't install or already installed
    if (!canInstall && !isInstalled && !showSuccess) return null;

    // Show success message briefly
    if (showSuccess || isInstalled) {
        return (
            <div className={`flex items-center gap-2 text-emerald-400 text-sm ${className}`}>
                <Check className="w-4 h-4" />
                <span>App installed!</span>
            </div>
        );
    }

    // Banner variant (full-width)
    if (variant === 'banner') {
        return (
            <div className={`bg-gradient-to-r from-emerald-900/90 to-emerald-800/90 backdrop-blur-lg border-b border-emerald-700/30 ${className}`}>
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                            <Smartphone className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-white font-medium text-sm">Install CleanUpCrew</p>
                            <p className="text-emerald-200/70 text-xs">Add to home screen for quick access</p>
                        </div>
                    </div>
                    <button
                        onClick={handleInstall}
                        disabled={installing}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-600 text-white font-medium py-2 px-4 rounded-xl transition-all text-sm"
                    >
                        {installing ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        Install
                    </button>
                </div>
            </div>
        );
    }

    // Floating variant (fixed bottom right)
    if (variant === 'floating') {
        return (
            <button
                onClick={handleInstall}
                disabled={installing}
                className={`fixed bottom-20 right-4 flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-medium py-3 px-5 rounded-full shadow-lg shadow-emerald-500/30 transition-all z-40 ${className}`}
            >
                {installing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <Download className="w-5 h-5" />
                )}
                <span>Install App</span>
            </button>
        );
    }

    // Default variant (inline button)
    return (
        <button
            onClick={handleInstall}
            disabled={installing}
            className={`flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-medium py-2.5 px-4 rounded-xl transition-all text-sm ${className}`}
        >
            {installing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
                <Download className="w-4 h-4" />
            )}
            Install App
        </button>
    );
};

export default InstallAppButton;
