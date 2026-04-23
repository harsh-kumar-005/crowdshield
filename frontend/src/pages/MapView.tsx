import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useSocketData } from '../context/SocketContext';

const position: [number, number] = [12.9788, 77.5996];

// Fixed gate positions around the stadium so the dots don't randomly jump
const GATE_POSITIONS: [number, number][] = [
  [12.9802, 77.5990], // Gate 1 - North
  [12.9774, 77.5990], // Gate 2 - South
  [12.9788, 77.6010], // Gate 3 - East
  [12.9788, 77.5975], // Gate 4 - West
];

const MapView = () => {
  const { crowdData, isConnected } = useSocketData();

  const zones = crowdData
    ? crowdData.gates.map((g: any, i: number) => ({
        id: g.id,
        count: g.count,
        pos: GATE_POSITIONS[i] || position,
      }))
    : [];

  return (
    <div className="h-full flex flex-col space-y-4" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live Venue Map</h1>
          <p className="text-sm text-slate-500 mt-1">M Chinnaswamy Stadium — Real-time crowd positions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-sm text-slate-500">{isConnected ? 'Live Feed Active' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
        <MapContainer center={position} zoom={17} className="w-full h-full" zoomControl={true} style={{ height: '100%', minHeight: '500px' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {zones.map((zone: any) => {
            const isHighDensity = zone.count > 400;
            const color = isHighDensity ? '#ef4444' : '#3b82f6';
            return (
              <CircleMarker
                key={zone.id}
                center={zone.pos}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 2 }}
                radius={Math.min(zone.count / 10 + 12, 60)}
              >
                <Tooltip direction="top" opacity={1} permanent>
                  <div className="font-semibold text-xs">{zone.id}</div>
                  <div className="text-xs">{zone.count.toLocaleString()} people</div>
                  {isHighDensity && (
                    <div className="text-red-600 font-bold text-xs uppercase mt-0.5">⚠ High Risk</div>
                  )}
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-6 right-6 z-[1000] bg-white p-4 rounded-lg shadow-lg border border-slate-200">
          <h4 className="text-sm font-semibold mb-2 text-slate-800">Density Legend</h4>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-slate-600">Normal (0–400)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-slate-600">Critical (400+)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;
