import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CameraOff, MonitorPlay, Users, Zap, WifiOff } from 'lucide-react';
import { useSocketData } from '../context/SocketContext';

const LiveFeed = () => {
  const { socket, isConnected } = useSocketData();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIdRef = useRef(0);
  const intervalRef = useRef<number>(0);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [personCount, setPersonCount] = useState(0);
  const [avgConfidence, setAvgConfidence] = useState(0);
  const [framesProcessed, setFramesProcessed] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [boxes, setBoxes] = useState<any[]>([]);

  // ── Start webcam ─────────────────────────────────────────────────
  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      startCapturing();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found. Make sure a webcam is connected.');
      } else {
        setCameraError(`Camera error: ${err.message}`);
      }
    }
  };

  const stopCamera = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
    setPersonCount(0);
    setBoxes([]);
  };

  // ── Capture frame and send via WebSocket ─────────────────────────
  const captureAndSend = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !socket || video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Convert to base64 JPEG (quality 0.7 for bandwidth)
    const b64 = canvas.toDataURL('image/jpeg', 0.7);

    frameIdRef.current += 1;
    setProcessing(true);

    socket.emit('camera_frame', {
      image_base64: b64,
      frame_id: frameIdRef.current,
    });
  }, [socket]);

  const startCapturing = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    // Send a frame every 3 seconds
    intervalRef.current = window.setInterval(() => {
      captureAndSend();
    }, 3000);
  }, [captureAndSend]);

  // ── Listen for YOLO detection results ────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleResult = (data: { person_count: number; boxes: any[]; frame_id: number; avg_confidence: number }) => {
      setPersonCount(data.person_count);
      setAvgConfidence(data.avg_confidence);
      setBoxes(data.boxes);
      setFramesProcessed(prev => prev + 1);
      setProcessing(false);
    };

    socket.on('detection_result', handleResult);
    return () => { socket.off('detection_result', handleResult); };
  }, [socket]);

  // ── Draw bounding boxes overlay ──────────────────────────────────
  useEffect(() => {
    const overlay = overlayRef.current;
    const video = videoRef.current;
    if (!overlay || !video || !cameraActive) return;

    overlay.width = video.videoWidth || 640;
    overlay.height = video.videoHeight || 480;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    boxes.forEach(box => {
      const x = box.x * overlay.width;
      const y = box.y * overlay.height;
      const w = box.w * overlay.width;
      const h = box.h * overlay.height;

      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Label
      ctx.fillStyle = 'rgba(34,197,94,0.85)';
      ctx.fillRect(x, y - 18, 60, 18);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText(`${box.conf}%`, x + 4, y - 5);
    });
  }, [boxes, cameraActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <MonitorPlay className="text-emerald-500" size={26} />
          Live Camera Feed
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Connect your webcam — The AI Vision Engine counts people in real-time and feeds the count into the dashboard pipeline
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Preview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative bg-slate-900 rounded-xl overflow-hidden shadow-lg aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              style={{ display: cameraActive ? 'block' : 'none' }}
            />
            <canvas ref={canvasRef} className="hidden" />
            {/* Detection overlay */}
            <canvas
              ref={overlayRef}
              className="absolute inset-0 w-full h-full"
              style={{ display: cameraActive ? 'block' : 'none' }}
            />

            {/* Status overlays */}
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                <CameraOff size={48} className="mb-3 opacity-40" />
                <p className="font-semibold">Camera is offline</p>
                <p className="text-sm mt-1 text-slate-500">Click "Start Camera" to begin</p>
              </div>
            )}
            {cameraActive && processing && (
              <div className="absolute top-3 right-3 bg-emerald-500/90 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse flex items-center gap-1.5">
                <Zap size={12} /> AI processing…
              </div>
            )}
            {cameraActive && !processing && personCount > 0 && (
              <div className="absolute top-3 right-3 bg-emerald-600/90 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <Users size={12} /> {personCount} detected
              </div>
            )}

            {/* Data source badge */}
            <div className="absolute bottom-3 left-3">
              <div className={`text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 ${cameraActive ? 'bg-emerald-500/90 text-white' : 'bg-slate-600/90 text-slate-200'}`}>
                {cameraActive ? <><Camera size={12} /> Live Camera</> : <><WifiOff size={12} /> Using Simulated Data</>}
              </div>
            </div>
          </div>

          {cameraError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{cameraError}</div>
          )}

          {/* Controls */}
          <div className="flex gap-3">
            {!cameraActive ? (
              <button onClick={startCamera}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                <Camera size={18} /> Start Camera
              </button>
            ) : (
              <button onClick={stopCamera}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                <CameraOff size={18} /> Stop Camera
              </button>
            )}
          </div>

          {/* How it works */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
            <strong>How it works:</strong> Your browser captures a webcam frame every 3 seconds →
            sends it via WebSocket to the Node.js backend →
            the backend forwards it to the Python ML engine →
            The AI Vision Engine counts every person in the frame →
            that count replaces the simulated numbers on the Dashboard.
          </div>
        </div>

        {/* Stats Panel */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
            <Users className="mx-auto text-emerald-500 mb-2" size={28} />
            <div className="text-4xl font-bold text-slate-900">{personCount}</div>
            <p className="text-sm text-slate-500 mt-1">People Detected</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
            <Zap className="mx-auto text-blue-500 mb-2" size={28} />
            <div className="text-4xl font-bold text-slate-900">{avgConfidence}%</div>
            <p className="text-sm text-slate-500 mt-1">Avg Confidence</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
            <Camera className="mx-auto text-purple-500 mb-2" size={28} />
            <div className="text-4xl font-bold text-slate-900">{framesProcessed}</div>
            <p className="text-sm text-slate-500 mt-1">Frames Processed</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-sm text-slate-700 mb-3">Connection Status</h3>
            <div className="space-y-2">
              {[
                ['WebSocket', isConnected],
                ['Camera', cameraActive],
                ['Vision Model', isConnected],
              ].map(([name, ok]) => (
                <div key={name as string} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{name as string}</span>
                  <span className={`flex items-center gap-1.5 font-medium ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <div className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    {ok ? 'Online' : 'Offline'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500">
            <strong className="text-slate-700">Note:</strong> In a real deployment, each gate would have an IP camera.
            Your webcam simulates one camera. The count is multiplied by 1000× to represent venue-scale numbers on the Dashboard.
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveFeed;
