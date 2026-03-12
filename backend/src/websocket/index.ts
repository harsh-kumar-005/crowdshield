import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

export const setupWebSocket = (server: HttpServer) => {
  const io = new Server(server, {
    cors: {
      origin: '*', // In production, restrict to frontend URL
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Mock data simulation - emits every 3 seconds
    const interval = setInterval(() => {
      const mockCrowdData = {
        totalCrowd: Math.floor(Math.random() * 5000) + 10000, // 10k - 15k
        activeAlerts: Math.random() > 0.8 ? 1 : 0,
        gates: Array.from({ length: 4 }).map((_, i) => ({
          id: `Gate ${i + 1}`,
          count: Math.floor(Math.random() * 500)
        })),
        timestamp: new Date().toISOString()
      };
      
      socket.emit('crowd_update', mockCrowdData);
      
      // Randomly trigger a critical alert
      if (Math.random() > 0.95) {
        socket.emit('critical_alert', {
          message: 'High density detected at Gate 3! Suggesting redirection.',
          level: 'critical',
          timestamp: new Date().toISOString()
        });
      }
    }, 3000);

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      clearInterval(interval);
    });
  });

  return io;
};
