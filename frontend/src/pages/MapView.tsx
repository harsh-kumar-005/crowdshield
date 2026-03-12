import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useSocket } from '../hooks/useSocket';

// Venue Center Coordinates (M Chinnaswamy Stadium, roughly)
const position: [number, number] = [12.9788, 77.5996];

const MapView = () => {
  const { socket } = useSocket();
  const [crowdData, setCrowdData] = React.useState<any>(null);

  useEffect(() => {
    if (!socket) return;
    socket.on('crowd_update', (data) => setCrowdData(data));
    return () => { socket.off('crowd_update'); };
  }, [socket]);

  // Generate fake map zones based on the crowd data to simulate a heatmap
  const zones = crowdData ? crowdData.gates.map((g: any, i: number) => ({
    id: g.id,
    count: g.count,
    // Add small random offsets to position to spread them around the stadium
    pos: [
      position[0] + (Math.random() - 0.5) * 0.003,
      position[1] + (Math.random() - 0.5) * 0.003
    ] as [number, number]
  })) : [];

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Live Venue Map</h1>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
        <MapContainer center={position} zoom={18} className="w-full h-full" zoomControl={false}>
          {/* Dark themed map tile */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          {/* Render 'Hotspots' based on gate counts */}
          {zones.map((zone: any) => {
             // Calculate color based on density (>400 is critical)
             const isHighDensity = zone.count > 400;
             const color = isHighDensity ? '#ef4444' : '#3b82f6'; // red : blue
             
             return (
               <CircleMarker 
                  key={zone.id} 
                  center={zone.pos} 
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.6 }}
                  radius={zone.count / 15 + 10} // Scale circle radius by people count
               >
                 <Tooltip direction="top" opacity={1} permanent>
                    <div className="font-semibold">{zone.id}</div>
                    <div>{zone.count} people</div>
                    {isHighDensity && <div className="text-red-500 font-bold text-xs uppercase mt-1">High Risk</div>}
                 </Tooltip>
               </CircleMarker>
             )
          })}
        </MapContainer>
        
        {/* Map overlay legend */}
        <div className="absolute bottom-6 right-6 z-[1000] bg-white p-4 rounded-lg shadow-lg border border-slate-200">
           <h4 className="text-sm font-semibold mb-2">Crowd Density Legend</h4>
           <div className="space-y-2 text-sm">
             <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Normal (0 - 400)</div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div> Critical (400+)</div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;
