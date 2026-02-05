/**
 * useWebSocket Hook
 * 
 * React hook for WebSocket connections with:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat/ping-pong to keep connection alive
 * - Message queuing during disconnection
 * - Event callbacks for different message types
 */
import { useState, useEffect, useCallback, useRef } from 'react';

const RECONNECT_INITIAL_DELAY = 1000; // 1 second
const RECONNECT_MAX_DELAY = 30000; // 30 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const MESSAGE_QUEUE_MAX_SIZE = 100;

/**
 * Connection states
 */
export const ConnectionState = {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    RECONNECTING: 'reconnecting',
    ERROR: 'error',
};

/**
 * WebSocket hook for real-time updates
 * 
 * @param {string} url - WebSocket URL (e.g., ws://localhost:8000/api/ws/admin)
 * @param {Object} options - Configuration options
 * @param {string} options.token - JWT token for authentication
 * @param {boolean} options.autoConnect - Auto-connect on mount (default: true)
 * @param {boolean} options.autoReconnect - Auto-reconnect on disconnect (default: true)
 * @param {function} options.onMessage - Callback for all messages
 * @param {function} options.onConnect - Callback on connection established
 * @param {function} options.onDisconnect - Callback on disconnection
 * @param {function} options.onError - Callback on error
 * @param {Object} options.messageHandlers - Map of message type to handler function
 */
export function useWebSocket(url, options = {}) {
    const {
        token,
        autoConnect = true,
        autoReconnect = true,
        onMessage,
        onConnect,
        onDisconnect,
        onError,
        messageHandlers = {},
    } = options;

    const [connectionState, setConnectionState] = useState(ConnectionState.DISCONNECTED);
    const [lastMessage, setLastMessage] = useState(null);
    const [error, setError] = useState(null);

    const wsRef = useRef(null);
    const reconnectAttemptRef = useRef(0);
    const reconnectTimeoutRef = useRef(null);
    const heartbeatIntervalRef = useRef(null);
    const messageQueueRef = useRef([]);

    /**
     * Build full WebSocket URL with token
     */
    const buildUrl = useCallback(() => {
        const fullUrl = new URL(url, window.location.origin);
        fullUrl.protocol = fullUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        if (token) {
            fullUrl.searchParams.set('token', token);
        }
        return fullUrl.toString();
    }, [url, token]);

    /**
     * Start heartbeat to keep connection alive
     */
    const startHeartbeat = useCallback(() => {
        stopHeartbeat();
        heartbeatIntervalRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'ping' }));
            }
        }, HEARTBEAT_INTERVAL);
    }, []);

    /**
     * Stop heartbeat
     */
    const stopHeartbeat = useCallback(() => {
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }
    }, []);

    /**
     * Calculate reconnection delay with exponential backoff
     */
    const getReconnectDelay = useCallback(() => {
        const delay = Math.min(
            RECONNECT_INITIAL_DELAY * Math.pow(2, reconnectAttemptRef.current),
            RECONNECT_MAX_DELAY
        );
        reconnectAttemptRef.current += 1;
        return delay;
    }, []);

    /**
     * Schedule reconnection
     */
    const scheduleReconnect = useCallback(() => {
        if (!autoReconnect) return;

        const delay = getReconnectDelay();
        console.log(`WebSocket reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`);

        setConnectionState(ConnectionState.RECONNECTING);

        reconnectTimeoutRef.current = setTimeout(() => {
            connect();
        }, delay);
    }, [autoReconnect, getReconnectDelay]);

    /**
     * Connect to WebSocket
     */
    const connect = useCallback(() => {
        // Clean up existing connection
        if (wsRef.current) {
            wsRef.current.close();
        }

        setConnectionState(ConnectionState.CONNECTING);
        setError(null);

        try {
            const ws = new WebSocket(buildUrl());
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket connected');
                setConnectionState(ConnectionState.CONNECTED);
                reconnectAttemptRef.current = 0;
                startHeartbeat();

                // Flush message queue
                while (messageQueueRef.current.length > 0) {
                    const msg = messageQueueRef.current.shift();
                    ws.send(JSON.stringify(msg));
                }

                onConnect?.();
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setLastMessage(data);

                    // Handle pong (heartbeat response)
                    if (data.type === 'pong') {
                        return;
                    }

                    // Call type-specific handler
                    const handler = messageHandlers[data.type];
                    if (handler) {
                        handler(data);
                    }

                    // Call general message handler
                    onMessage?.(data);
                } catch (e) {
                    console.error('Error parsing WebSocket message:', e);
                }
            };

            ws.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                setConnectionState(ConnectionState.DISCONNECTED);
                stopHeartbeat();
                onDisconnect?.();

                // Reconnect unless it was a clean close or auth error
                if (event.code !== 1000 && event.code !== 4001) {
                    scheduleReconnect();
                }
            };

            ws.onerror = (event) => {
                console.error('WebSocket error:', event);
                setError('WebSocket connection error');
                setConnectionState(ConnectionState.ERROR);
                onError?.(event);
            };
        } catch (e) {
            console.error('Error creating WebSocket:', e);
            setError(e.message);
            setConnectionState(ConnectionState.ERROR);
            scheduleReconnect();
        }
    }, [
        buildUrl,
        startHeartbeat,
        stopHeartbeat,
        scheduleReconnect,
        onConnect,
        onMessage,
        onDisconnect,
        onError,
        messageHandlers
    ]);

    /**
     * Disconnect from WebSocket
     */
    const disconnect = useCallback(() => {
        // Cancel pending reconnection
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        stopHeartbeat();

        if (wsRef.current) {
            wsRef.current.close(1000, 'Client disconnect');
            wsRef.current = null;
        }

        setConnectionState(ConnectionState.DISCONNECTED);
    }, [stopHeartbeat]);

    /**
     * Send a message
     */
    const sendMessage = useCallback((data) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
            return true;
        } else {
            // Queue message for later
            if (messageQueueRef.current.length < MESSAGE_QUEUE_MAX_SIZE) {
                messageQueueRef.current.push(data);
            }
            return false;
        }
    }, []);

    /**
     * Subscribe to a channel
     */
    const subscribe = useCallback((channel) => {
        return sendMessage({ type: 'subscribe', channel });
    }, [sendMessage]);

    /**
     * Unsubscribe from a channel
     */
    const unsubscribe = useCallback((channel) => {
        return sendMessage({ type: 'unsubscribe', channel });
    }, [sendMessage]);

    // Auto-connect on mount
    useEffect(() => {
        if (autoConnect && token) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [autoConnect, token]); // Only reconnect when token changes

    return {
        connectionState,
        isConnected: connectionState === ConnectionState.CONNECTED,
        lastMessage,
        error,
        connect,
        disconnect,
        sendMessage,
        subscribe,
        unsubscribe,
    };
}

export default useWebSocket;
