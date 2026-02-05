/* eslint-disable no-restricted-globals */

/**
 * Enhanced Service Worker for CleanUpCrew PWA
 * 
 * Features:
 * - Cache versioning for updates
 * - Network-first for API calls
 * - Cache-first for static assets
 * - Stale-while-revalidate for images
 * - Offline fallback page
 * - Background sync for bookings
 */

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `cleanup-crew-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `cleanup-crew-dynamic-${CACHE_VERSION}`;
const API_CACHE = `cleanup-crew-api-${CACHE_VERSION}`;

// Static assets to precache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// API endpoints to cache
const API_PATTERNS = [
    '/api/services',
    '/api/addons'
];

// ============ INSTALL EVENT ============
self.addEventListener('install', event => {
    console.log('[SW] Installing service worker...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW] Precaching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                // Skip waiting to activate immediately
                return self.skipWaiting();
            })
    );
});

// ============ ACTIVATE EVENT ============
self.addEventListener('activate', event => {
    console.log('[SW] Activating service worker...');

    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => {
                            // Delete old version caches
                            return cacheName.startsWith('cleanup-crew-') &&
                                !cacheName.includes(CACHE_VERSION);
                        })
                        .map(cacheName => {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                // Claim clients immediately
                return self.clients.claim();
            })
    );
});

// ============ FETCH EVENT ============
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // API requests: Network-first with cache fallback
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }

    // Images: Stale-while-revalidate
    if (request.destination === 'image') {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }

    // Static assets: Cache-first
    event.respondWith(cacheFirstStrategy(request));
});

// ============ CACHING STRATEGIES ============

/**
 * Cache-first: Try cache, fall back to network
 */
async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);

        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            return caches.match('/offline.html');
        }
        throw error;
    }
}

/**
 * Network-first: Try network, fall back to cache
 */
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request);

        // Cache successful GET responses for API
        if (networkResponse.ok) {
            const cache = await caches.open(API_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);

        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Return a JSON error for API requests
        return new Response(
            JSON.stringify({
                error: 'offline',
                message: 'You are currently offline. Please check your connection.'
            }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

/**
 * Stale-while-revalidate: Return cache immediately, update in background
 */
async function staleWhileRevalidate(request) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);

    // Fetch in background
    const fetchPromise = fetch(request)
        .then(networkResponse => {
            if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch(() => cachedResponse);

    // Return cached version immediately, or wait for network
    return cachedResponse || fetchPromise;
}

// ============ BACKGROUND SYNC ============
self.addEventListener('sync', event => {
    console.log('[SW] Background sync event:', event.tag);

    if (event.tag === 'sync-bookings') {
        event.waitUntil(syncPendingBookings());
    }
});

async function syncPendingBookings() {
    try {
        // Get pending bookings from IndexedDB
        const pendingBookings = await getPendingBookings();

        for (const booking of pendingBookings) {
            try {
                const response = await fetch('/api/bookings/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': booking.authToken
                    },
                    body: JSON.stringify(booking.data)
                });

                if (response.ok) {
                    await removePendingBooking(booking.id);

                    // Notify the user
                    self.registration.showNotification('Booking Confirmed!', {
                        body: 'Your offline booking has been submitted successfully.',
                        icon: '/icons/icon-192x192.png',
                        badge: '/icons/icon-96x96.png',
                        tag: 'booking-sync'
                    });
                }
            } catch (error) {
                console.error('[SW] Sync failed for booking:', booking.id);
            }
        }
    } catch (error) {
        console.error('[SW] Background sync error:', error);
    }
}

// IndexedDB helpers for background sync
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('cleanup-crew-offline', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('pending-bookings')) {
                db.createObjectStore('pending-bookings', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

async function getPendingBookings() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pending-bookings', 'readonly');
        const store = tx.objectStore('pending-bookings');
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
    });
}

async function removePendingBooking(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pending-bookings', 'readwrite');
        const store = tx.objectStore('pending-bookings');
        const request = store.delete(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

// ============ PUSH NOTIFICATIONS ============
self.addEventListener('push', event => {
    console.log('[SW] Push notification received');

    let data = {
        title: 'CleanUpCrew',
        body: 'You have a new notification',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png'
    };

    try {
        if (event.data) {
            data = { ...data, ...event.data.json() };
        }
    } catch (error) {
        console.error('[SW] Error parsing push data:', error);
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            tag: data.tag || 'default',
            data: data.data || {},
            actions: data.actions || [],
            vibrate: [200, 100, 200]
        })
    );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
    console.log('[SW] Notification clicked:', event.notification.tag);

    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                // Check if there's already a window open
                for (const client of windowClients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(urlToOpen);
                        return client.focus();
                    }
                }
                // Open new window
                return clients.openWindow(urlToOpen);
            })
    );
});

// ============ MESSAGE HANDLING ============
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'SAVE_BOOKING_OFFLINE') {
        savePendingBooking(event.data.booking);
    }
});

async function savePendingBooking(booking) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pending-bookings', 'readwrite');
        const store = tx.objectStore('pending-bookings');
        const request = store.add(booking);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            // Register for background sync
            self.registration.sync.register('sync-bookings');
            resolve(request.result);
        };
    });
}

console.log('[SW] Service worker loaded');
