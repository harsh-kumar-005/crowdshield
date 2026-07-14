import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_HOST ? `https://${import.meta.env.VITE_API_HOST}` : 'http://localhost:5000';

// Define the shape of what we share
interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  crowdData: any;
  alerts: any[];
  historicalData: any[];
}

// Create the context with default empty values
const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  crowdData: null,
  alerts: [],
  historicalData: [],
});

// The Provider wraps the whole app and holds ONE connection
export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [crowdData, setCrowdData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  useEffect(() => {
    const socketInstance = io(SOCKET_URL);

    socketInstance.on('connect', () => setIsConnected(true));
    socketInstance.on('disconnect', () => setIsConnected(false));

    socketInstance.on('crowd_update', (data) => {
      setCrowdData(data);
      setHistoricalData(prev => {
        const newPoint = {
          time: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          total: data.totalCrowd,
          risk: data.riskScore ?? 0,
        };
        return [...prev, newPoint].slice(-20);
      });
    });

    socketInstance.on('critical_alert', (alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 5));
    });

    setSocket(socketInstance);

    // Cleanup: disconnect when app unmounts
    return () => { socketInstance.disconnect(); };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, crowdData, alerts, historicalData }}>
      {children}
    </SocketContext.Provider>
  );
};

// Custom hook — components just call this instead of making their own connections
export const useSocketData = () => useContext(SocketContext);
