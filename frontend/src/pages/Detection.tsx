import { useState, useRef } from 'react';
import { ScanEye, Upload, X, Loader2, Users, CheckCircle2 } from 'lucide-react';

const ML_ENGINE_URL = import.meta.env.VITE_ML_HOST ? `https://${import.meta.env.VITE_ML_HOST}${import.meta.env.VITE_ML_HOST.includes('.onrender.com') ? '' : '.onrender.com'}` : 'http://localhost:8000';

const Detection = () => {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, etc.)');
      return;
    }
    setFile(f);
    setResult(null);
    setError('');
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleDetect = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${ML_ENGINE_URL}/detection/count`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Detection failed.');
      }

      setResult(await res.json());
    } catch (e: any) {
      if (e.message.includes('fetch')) {
        setError('Cannot connect to the ML Engine. Make sure it is running on port 8000.');
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ScanEye className="text-blue-500" size={28} />
          AI Person Detection
        </h1>
        <p className="text-slate-500 mt-1">
          Upload a crowd photo — YOLOv8 will count every person and mark them with bounding boxes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Zone */}
        <div className="space-y-4">
          {!preview ? (
            <div
              className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={40} className={`mb-3 ${dragOver ? 'text-blue-500' : 'text-slate-400'}`} />
              <p className="font-semibold text-slate-700">Drop an image here</p>
              <p className="text-sm text-slate-400 mt-1">or click to browse</p>
              <p className="text-xs text-slate-400 mt-3">JPG, PNG, WEBP supported</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              />
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm">
              <img src={preview} alt="Upload preview" className="w-full object-contain max-h-80" />
              <button
                onClick={clearAll}
                className="absolute top-2 right-2 bg-white/90 backdrop-blur rounded-full p-1.5 shadow text-slate-600 hover:text-red-500 transition"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <button
            onClick={handleDetect}
            disabled={!file || loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <><Loader2 size={20} className="animate-spin" /> Detecting People...</>
            ) : (
              <><ScanEye size={20} /> Run AI Detection</>
            )}
          </button>
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Annotated image */}
              <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <img
                  src={result.annotated_image_base64}
                  alt="YOLOv8 detection result"
                  className="w-full object-contain max-h-80"
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
                  <Users size={28} className="mx-auto text-blue-500 mb-1" />
                  <div className="text-4xl font-bold text-slate-900">{result.person_count}</div>
                  <div className="text-sm text-slate-500 mt-1">People Detected</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
                  <CheckCircle2 size={28} className="mx-auto text-emerald-500 mb-1" />
                  <div className="text-4xl font-bold text-slate-900">{result.avg_confidence_pct}%</div>
                  <div className="text-sm text-slate-500 mt-1">Avg Confidence</div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-sm text-blue-800">
                <strong>Model:</strong> YOLOv8 Nano &nbsp;•&nbsp;
                <strong>Class:</strong> Person (class 0)
              </div>
            </>
          ) : (
            <div className="h-full min-h-64 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 p-8">
              <ScanEye size={48} className="mb-3 opacity-40" />
              <p className="font-medium">Detection results will appear here</p>
              <p className="text-sm mt-1">Upload an image and click "Run AI Detection"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Detection;
