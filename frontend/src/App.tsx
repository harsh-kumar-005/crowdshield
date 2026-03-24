import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MapView from './pages/MapView';
import Events from './pages/Events';
import Detection from './pages/Detection';
import Simulation from './pages/Simulation';
import LiveFeed from './pages/LiveFeed';
import Settings from './pages/Settings';
import { SocketProvider } from './context/SocketContext';

const Login = () => <div className="p-8 max-w-md mx-auto mt-20 bg-white rounded shadow"><h1 className="text-2xl font-bold mb-4 text-center">Login to CrowdShield</h1><p className="text-center text-gray-500">Authentication coming soon.</p></div>;

function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Layout-wrapped routes */}
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/events" element={<Events />} />
            <Route path="/detection" element={<Detection />} />
            <Route path="/simulation" element={<Simulation />} />
            <Route path="/live-feed" element={<LiveFeed />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
}

export default App;
