import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../services/api';

interface UseWebSocketOptions {
  rideId?: string | number;
  onMessage?: (data: any) => void;
  reconnectInterval?: number;
}

export function useWebSocket({ rideId, onMessage, reconnectInterval = 3000 }: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const buildUrl = () => {
    if (!rideId) return '';
    const apiUrl = API_BASE_URL.replace(/\/$/, '');
    const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    const host = apiUrl.replace(/^https?:\/\//, '').replace(/\/api.*$/, '');
    return `${wsProtocol}://${host}/ws/rides/${rideId}/`;
  };

  const connect = () => {
    const url = buildUrl();
    if (!url) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (e) {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimerRef.current = setTimeout(connect, reconnectInterval);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      // fail silently
    }
  };

  const send = (data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  };

  const disconnect = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    wsRef.current?.close();
  };

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [rideId]);

  return { isConnected, send, disconnect };
}