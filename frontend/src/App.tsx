import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MapView from './pages/MapView';
import Events from './pages/Events';
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
            <Route path="/settings" element={<div className="p-8"><h1 className="text-2xl font-bold text-slate-900">Settings</h1><p className="text-slate-500 mt-2">Platform configuration coming soon.</p></div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
}

export default App;
