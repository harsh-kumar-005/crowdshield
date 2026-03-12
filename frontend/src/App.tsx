import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Placeholder Pages
const Dashboard = () => <div className="p-8"><h1 className="text-3xl font-bold text-brand-900">Dashboard</h1><p>Real-time crowd monitoring</p></div>;
const Login = () => <div className="p-8 max-w-md mx-auto mt-20 bg-white rounded shadow"><h1 className="text-2xl font-bold mb-4 text-center">Login to CrowdShield</h1><p className="text-center text-gray-500">Authentication coming soon.</p></div>;
const MapView = () => <div className="p-8"><h1 className="text-3xl font-bold">Venue Map</h1></div>;

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <nav className="bg-brand-900 text-white p-4 flex justify-between items-center shadow-md">
           <div className="text-xl font-bold tracking-wider flex items-center gap-2">
              <span className="bg-danger-500 w-3 h-3 rounded-full animate-pulse"></span>
              CROWDSHIELD
           </div>
           <div className="flex gap-4">
              <a href="/dashboard" className="hover:text-brand-100 transition">Dashboard</a>
              <a href="/map" className="hover:text-brand-100 transition">Map</a>
              <a href="/login" className="px-4 py-1 bg-white text-brand-900 rounded font-medium hover:bg-slate-100">Login</a>
           </div>
        </nav>
        
        <main className="container mx-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/map" element={<MapView />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
