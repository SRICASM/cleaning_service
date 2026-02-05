import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hooks for PWA functionality
 */

// ============ INSTALL PROMPT HOOK ============
/**
 * Hook to handle PWA install prompt
 * @returns {{ canInstall, promptInstall, isInstalled }}
 */
export function useInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [canInstall, setCanInstall] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already installed
        const checkInstalled = () => {
            if (window.matchMedia('(display-mode: standalone)').matches) {
                setIsInstalled(true);
                setCanInstall(false);
            }
        };
        checkInstalled();

        // Listen for beforeinstallprompt
        const handleBeforeInstall = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setCanInstall(true);
        };

        // Listen for successful install
        const handleInstalled = () => {
            setIsInstalled(true);
            setCanInstall(false);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', handleInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleInstalled);
        };
    }, []);

    const promptInstall = useCallback(async () => {
        if (!deferredPrompt) return false;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        setDeferredPrompt(null);
        setCanInstall(false);

        return outcome === 'accepted';
    }, [deferredPrompt]);

    return { canInstall, promptInstall, isInstalled };
}

// ============ ONLINE STATUS HOOK ============
/**
 * Hook to track online/offline status
 * @returns {{ isOnline, wasOffline }}
 */
export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [wasOffline, setWasOffline] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            if (!isOnline) {
                setWasOffline(true);
                // Auto-clear "was offline" after 5 seconds
                setTimeout(() => setWasOffline(false), 5000);
            }
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [isOnline]);

    return { isOnline, wasOffline };
}

// ============ PUSH NOTIFICATION HOOK ============
/**
 * Hook to handle push notifications
 * @returns {{ permission, requestPermission, subscribe, unsubscribe }}
 */
export function usePushNotifications() {
    const [permission, setPermission] = useState(
        'Notification' in window ? Notification.permission : 'unsupported'
    );
    const [subscription, setSubscription] = useState(null);

    useEffect(() => {
        // Get existing subscription
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.ready.then(registration => {
                registration.pushManager.getSubscription().then(sub => {
                    setSubscription(sub);
                });
            });
        }
    }, []);

    const requestPermission = useCallback(async () => {
        if (!('Notification' in window)) {
            return 'unsupported';
        }

        const result = await Notification.requestPermission();
        setPermission(result);
        return result;
    }, []);

    const subscribe = useCallback(async (vapidPublicKey) => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            throw new Error('Push notifications not supported');
        }

        // Request permission first
        if (Notification.permission !== 'granted') {
            const result = await requestPermission();
            if (result !== 'granted') {
                throw new Error('Notification permission denied');
            }
        }

        const registration = await navigator.serviceWorker.ready;

        // Convert VAPID key to Uint8Array
        const urlBase64ToUint8Array = (base64String) => {
            const padding = '='.repeat((4 - base64String.length % 4) % 4);
            const base64 = (base64String + padding)
                .replace(/-/g, '+')
                .replace(/_/g, '/');
            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
            }
            return outputArray;
        };

        const sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });

        setSubscription(sub);
        return sub;
    }, [requestPermission]);

    const unsubscribe = useCallback(async () => {
        if (subscription) {
            await subscription.unsubscribe();
            setSubscription(null);
        }
    }, [subscription]);

    return {
        permission,
        isSubscribed: !!subscription,
        subscription,
        requestPermission,
        subscribe,
        unsubscribe
    };
}

// ============ BACKGROUND SYNC HOOK ============
/**
 * Hook to handle background sync for offline operations
 * @returns {{ queueOperation, hasPendingOperations }}
 */
export function useBackgroundSync() {
    const [hasPending, setHasPending] = useState(false);

    const queueOperation = useCallback(async (operation) => {
        if (!('serviceWorker' in navigator)) {
            throw new Error('Service worker not supported');
        }

        // Send to service worker via message
        const registration = await navigator.serviceWorker.ready;

        if (registration.active) {
            registration.active.postMessage({
                type: 'SAVE_BOOKING_OFFLINE',
                booking: operation
            });
            setHasPending(true);

            // Try to register for background sync
            if ('sync' in registration) {
                try {
                    await registration.sync.register('sync-bookings');
                } catch (err) {
                    console.log('Background sync registration failed:', err);
                }
            }
        }
    }, []);

    return { queueOperation, hasPendingOperations: hasPending };
}

// ============ SERVICE WORKER UPDATE HOOK ============
/**
 * Hook to check for service worker updates
 * @returns {{ checkForUpdates, isUpdateAvailable }}
 */
export function useServiceWorkerUpdate() {
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
    const [registration, setRegistration] = useState(null);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => {
                setRegistration(reg);

                if (reg.waiting) {
                    setIsUpdateAvailable(true);
                }

                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            setIsUpdateAvailable(true);
                        }
                    });
                });
            });
        }
    }, []);

    const checkForUpdates = useCallback(async () => {
        if (registration) {
            await registration.update();
        }
    }, [registration]);

    const applyUpdate = useCallback(() => {
        if (registration && registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
    }, [registration]);

    return { checkForUpdates, isUpdateAvailable, applyUpdate };
}
