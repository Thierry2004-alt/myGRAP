import { useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE_URL } from '../services/api';
import { safeStorage } from '../services/storage';

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
  const generationRef = useRef(0);
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
    generationRef.current += 1;
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

  const connect = useCallback(async () => {
    disconnect();
    const url = buildUrl();
    if (!url) return;

    const generation = generationRef.current;
    try {
      const token = await safeStorage.getItem('grap_access_token');
      if (!token) {
        console.error('Cannot connect to ride updates without an access token.');
        return;
      }
      if (generation !== generationRef.current) return;

      const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (wsRef.current !== ws) return;
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
        if (wsRef.current !== ws) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return;
          onMessageRef.current?.(data);
        } catch (e) {
          // ignore non-json
        }
      };

      ws.onclose = (event) => {
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        setIsConnected(false);
        if (pingTimerRef.current) {
          clearInterval(pingTimerRef.current);
          pingTimerRef.current = null;
        }
        // Auto-reconnect if rideId is still present and not cleanly closed
        if (rideId && event.code !== 1000 && event.code !== 4401 && event.code !== 4403) {
          reconnectTimerRef.current = setTimeout(() => void connect(), reconnectInterval);
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
        console.error('Failed to establish ride WebSocket connection:', e);
        reconnectTimerRef.current = setTimeout(() => void connect(), reconnectInterval);
      }
    }
  }, [buildUrl, disconnect, reconnectInterval, rideId]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    if (rideId) {
      void connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [rideId, connect, disconnect]);

  return { isConnected, send, disconnect };
}