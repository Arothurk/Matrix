import React, { useState, useEffect } from 'react';
import { RefreshCw, Monitor, Eye, Zap, AlertTriangle, FlipHorizontal } from 'lucide-react';
import MatrixCanvas from './components/MatrixCanvas';
import TerminalOutput from './components/TerminalOutput';
import { decodeMatrixImage } from './services/gemini';
import { AppState, CameraDevice } from './types';

const App: React.FC = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [captureTrigger, setCaptureTrigger] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState<string[]>(["System initialized...", "Waiting for camera input..."]);
  const [showTerminal, setShowTerminal] = useState(true);
  const [density, setDensity] = useState(14); // Font size / Grid density
  const [isMirrored, setIsMirrored] = useState(false); // Default to standard view

  // Initial Camera Setup
  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true }); // Request perm first
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices
          .filter(d => d.kind === 'videoinput')
          .map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 5)}...` }));
        
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
          setCurrentDeviceId(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error("Permission denied or no camera", err);
        setTerminalLogs(prev => [...prev, "ERROR: Camera access denied. Critical system failure."]);
        setAppState(AppState.ERROR);
      }
    };
    getDevices();
  }, []);

  // Switch Camera Stream
  useEffect(() => {
    if (!currentDeviceId) return;
    
    const startStream = async () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            deviceId: { exact: currentDeviceId },
            width: { ideal: 1280 }, // Good balance for performance
            height: { ideal: 720 }
          }
        });
        setStream(newStream);
        setAppState(AppState.STREAMING);
        setTerminalLogs(prev => [...prev, `Video feed connection established: ${currentDeviceId.slice(0,8)}...`]);
      } catch (err) {
        console.error("Stream error", err);
        setTerminalLogs(prev => [...prev, "ERROR: Failed to acquire video feed."]);
        setAppState(AppState.ERROR);
      }
    };

    startStream();
    
    // Cleanup
    return () => {
      // We don't stop the stream here to avoid flickering when strict mode runs effect twice
      // Handled by the check at start of function
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDeviceId]);

  const handleSwitchCamera = () => {
    const currentIndex = devices.findIndex(d => d.deviceId === currentDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    if (devices[nextIndex]) {
      setCurrentDeviceId(devices[nextIndex].deviceId);
    }
  };

  const handleCapture = () => {
    setCaptureTrigger(prev => prev + 1);
    setAppState(AppState.ANALYZING);
    setShowTerminal(true);
    setTerminalLogs(prev => [...prev, "Capturing frame for analysis..."]);
  };

  const onFrameCaptured = async (dataUrl: string) => {
    // Send to Gemini
    try {
      const result = await decodeMatrixImage(dataUrl);
      setTerminalLogs(prev => [...prev, `>> DECODED: ${result}`]);
    } catch (e) {
      setTerminalLogs(prev => [...prev, ">> DECODING FAILED."]);
    } finally {
      setAppState(AppState.STREAMING);
    }
  };

  const toggleDensity = () => {
    setDensity(prev => prev === 14 ? 8 : (prev === 8 ? 20 : 14));
    setTerminalLogs(prev => [...prev, `Resolution density adjusted.`]);
  };

  const toggleMirror = () => {
    setIsMirrored(prev => !prev);
    setTerminalLogs(prev => [...prev, `Visual feed mirrored: ${!isMirrored}`]);
  };

  return (
    <div className="relative w-screen h-screen bg-black text-green-500 overflow-hidden flex flex-col">
      {/* Main Viewport */}
      <div className="flex-1 relative z-0">
        {appState === AppState.ERROR ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <AlertTriangle size={64} className="animate-pulse" />
            <p className="text-xl font-mono">SIGNAL LOST</p>
            <p className="text-xs opacity-50">Please allow camera permissions.</p>
          </div>
        ) : (
          <MatrixCanvas 
            stream={stream} 
            isActive={appState !== AppState.ERROR} 
            onFrameCapture={onFrameCaptured}
            captureTrigger={captureTrigger}
            density={density}
            isMirrored={isMirrored}
          />
        )}
      </div>

      {/* Overlay UI */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
        {/* Header */}
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="flex flex-col">
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tighter shadow-green-glow">MATRIX VISION</h1>
            <span className="text-xs text-green-700 animate-pulse">v2.5.0-beta // CONNECTED</span>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setShowTerminal(!showTerminal)}
              className={`p-2 border border-green-800 bg-black/50 backdrop-blur-md rounded hover:bg-green-900/30 transition-colors ${showTerminal ? 'text-green-400' : 'text-green-800'}`}
              title="Toggle Terminal"
            >
              <Monitor size={20} />
            </button>
          </div>
        </div>

        {/* Center Crosshair (Aesthetic) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-green-500/20 rounded-full flex items-center justify-center pointer-events-none">
           <div className="w-2 h-2 bg-green-500/50 rounded-full"></div>
           <div className="absolute top-0 w-px h-4 bg-green-500/50"></div>
           <div className="absolute bottom-0 w-px h-4 bg-green-500/50"></div>
           <div className="absolute left-0 h-px w-4 bg-green-500/50"></div>
           <div className="absolute right-0 h-px w-4 bg-green-500/50"></div>
        </div>

        {/* Footer Controls */}
        <div className="flex flex-col gap-4 pointer-events-auto">
          {/* Action Bar */}
          <div className="flex items-center justify-center gap-6 sm:gap-12 pb-4 sm:pb-8">
            {/* Density Toggle */}
            <button 
              onClick={toggleDensity}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-12 h-12 rounded-full border border-green-600 bg-black/80 flex items-center justify-center group-active:scale-95 transition-all shadow-[0_0_15px_rgba(0,255,0,0.2)]">
                <Eye size={20} className="group-hover:text-white transition-colors" />
              </div>
              <span className="text-[10px] uppercase tracking-widest opacity-70">Grid</span>
            </button>

            {/* Mirror Toggle (New) */}
            <button 
              onClick={toggleMirror}
              className="flex flex-col items-center gap-1 group"
            >
              <div className={`w-12 h-12 rounded-full border border-green-600 bg-black/80 flex items-center justify-center group-active:scale-95 transition-all shadow-[0_0_15px_rgba(0,255,0,0.2)] ${isMirrored ? 'bg-green-900/40 text-white' : ''}`}>
                <FlipHorizontal size={20} className="group-hover:text-white transition-colors" />
              </div>
              <span className="text-[10px] uppercase tracking-widest opacity-70">Flip</span>
            </button>

            {/* Main Action: Analyze */}
            <button 
              onClick={handleCapture}
              disabled={appState === AppState.ANALYZING || appState === AppState.ERROR}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-20 h-20 rounded-full border-2 border-green-400 bg-green-900/20 flex items-center justify-center group-active:scale-90 transition-all shadow-[0_0_30px_rgba(0,255,0,0.4)] relative overflow-hidden">
                <div className="absolute inset-0 bg-green-500/10 animate-pulse"></div>
                <Zap size={32} className={`text-green-400 ${appState === AppState.ANALYZING ? 'animate-spin' : ''}`} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-green-400 shadow-black drop-shadow-md">Decipher</span>
            </button>

            {/* Camera Switch */}
            <button 
              onClick={handleSwitchCamera}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-12 h-12 rounded-full border border-green-600 bg-black/80 flex items-center justify-center group-active:scale-95 transition-all shadow-[0_0_15px_rgba(0,255,0,0.2)]">
                <RefreshCw size={20} className="group-hover:text-white transition-colors" />
              </div>
              <span className="text-[10px] uppercase tracking-widest opacity-70">Cam</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Terminal Drawer */}
      {showTerminal && (
        <TerminalOutput 
          logs={terminalLogs} 
          isAnalyzing={appState === AppState.ANALYZING} 
          onClose={() => setShowTerminal(false)}
        />
      )}
    </div>
  );
};

export default App;