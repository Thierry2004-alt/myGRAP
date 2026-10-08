import { useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE_URL } from '../services/api';

interface UseWebSocketOptions {
  rideId?: string | number | null;
  onMessage?: (data: any) => void;
  reconnectInterval?: number;
}

export function useWebSocket({ rideId, onMessage, reconnectInterval = 3000 }: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<any>(null);
  const pingTimerRef = useRef<any>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const buildUrl = useCallback(() => {
    if (!rideId) return '';
    const cleanId = String(rideId).replace(/[^0-9]/g, '') || rideId;
    const apiUrl = API_BASE_URL.replace(/\/$/, '');
    const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    const host = apiUrl.replace(/^https?:\/\//, '').replace(/\/api.*$/, '');
    return `${wsProtocol}://${host}/ws/rides/${cleanId}/`;
  }, [rideId]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      } catch (e) {
        // ignore
      }
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    disconnect();
    const url = buildUrl();
    if (!url) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }

        // Heartbeat ping every 15s to keep socket alive through NAT/proxies
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ action: 'ping' }));
            } catch (e) {
              // ignore
            }
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return;
          onMessageRef.current?.(data);
        } catch (e) {
          // ignore non-json
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        if (pingTimerRef.current) {
          clearInterval(pingTimerRef.current);
          pingTimerRef.current = null;
        }
        // Auto-reconnect if rideId is still present and not cleanly closed
        if (rideId && event.code !== 1000) {
          reconnectTimerRef.current = setTimeout(connect, reconnectInterval);
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch (e) {
          // ignore
        }
      };
    } catch (e) {
      if (rideId) {
        reconnectTimerRef.current = setTimeout(connect, reconnectInterval);
      }
    }
  }, [buildUrl, disconnect, reconnectInterval, rideId]);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    if (rideId) {
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [rideId, connect, disconnect]);

  return { isConnected, send, disconnect };
}