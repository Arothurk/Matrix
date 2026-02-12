import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Monitor, Eye, Zap, AlertTriangle, FlipHorizontal, ShieldCheck, ShieldAlert, Wifi, WifiOff, Power } from 'lucide-react';
import MatrixCanvas from './components/MatrixCanvas';
import TerminalOutput from './components/TerminalOutput';
import { decodeMatrixImage, checkAIConnection } from './gemini';
import { AppState, CameraDevice } from './types';

const App: React.FC = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [captureTrigger, setCaptureTrigger] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState<string[]>(["System initialized...", "Booting Matrix interface..."]);
  const [showTerminal, setShowTerminal] = useState(true);
  const [density, setDensity] = useState(12);
  const [isMirrored, setIsMirrored] = useState(false); // Default false, but 'user' mode feels better mirrored usually
  
  // Status Indicators
  const [aiConnected, setAiConnected] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'PENDING' | 'ACTIVE' | 'ERROR' | 'DENIED'>('PENDING');
  
  const initializedRef = useRef(false);

  // 1. Deployment Self-Check & AI Initialization
  useEffect(() => {
    // HTTPS Check with Alert as requested
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      const msg = "Security Warning: Camera access requires a secure HTTPS connection. Please use a secure URL.";
      console.warn(msg);
      alert(msg); // Explicit user alert
      setTerminalLogs(prev => [...prev, "CRITICAL: INSECURE CONNECTION (HTTP).", "Camera access blocked by browser security policy."]);
    }

    // AI Configuration Check
    const isAIReady = checkAIConnection();
    setAiConnected(isAIReady);
    if (isAIReady) {
      setTerminalLogs(prev => [...prev, "Neural Network interface connected."]);
    } else {
      setTerminalLogs(prev => [...prev, "WAITING FOR CONFIGURATION...", "API_KEY not found."]);
    }
  }, []);

  // 2. Camera Initialization Logic
  const initializeCamera = async () => {
    setCameraStatus('PENDING');
    setAppState(AppState.IDLE);
    
    // Browser Capability Check
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setTerminalLogs(prev => [...prev, "CRITICAL ERROR: Camera API unavailable."]);
      setAppState(AppState.ERROR);
      setCameraStatus('ERROR');
      return;
    }

    try {
      setTerminalLogs(prev => [...prev, "Requesting visual feed access..."]);
      
      // Request Permission - Explicitly asking for 'user' (Front Camera) as requested
      const initialStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user' 
        } 
      });
      
      // Enumerate Devices to find others if needed
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter(d => d.kind === 'videoinput')
        .map(d => ({ 
          deviceId: d.deviceId, 
          label: d.label || `Device ${d.deviceId.slice(0, 5)}...` 
        }));
      
      // Stop initial stream to switch to the tracked one
      initialStream.getTracks().forEach(track => track.stop());
      
      setDevices(videoDevices);
      
      if (videoDevices.length > 0) {
        setTerminalLogs(prev => [...prev, "Visual sensors detected.", `${videoDevices.length} devices online.`]);
        
        // Use the first available device, which usually matches the 'user' request if valid
        const targetDeviceId = videoDevices[0].deviceId;
        setCurrentDeviceId(targetDeviceId);
        setCameraStatus('ACTIVE');
      } else {
        setTerminalLogs(prev => [...prev, "ERROR: No visual sensors found."]);
        setAppState(AppState.ERROR);
        setCameraStatus('ERROR');
      }
    } catch (err: any) {
      console.error("Camera Init Error:", err);
      
      let errorMsg = "ERROR: Sensor access failed.";
      let status: 'ERROR' | 'DENIED' = 'ERROR';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = "ACCESS DENIED: Permission refused by user.";
        status = 'DENIED';
      } else if (err.name === 'NotFoundError') {
        errorMsg = "ERROR: Sensor device not found.";
      } else if (err.name === 'NotReadableError') {
        errorMsg = "ERROR: Sensor occupied by another process.";
      }

      setTerminalLogs(prev => [...prev, errorMsg]);
      setAppState(AppState.ERROR);
      setCameraStatus(status);
    }
  };

  // Run init on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    initializeCamera();
  }, []);

  // 3. Stream Handling
  useEffect(() => {
    if (!currentDeviceId) return;
    
    const startStream = async () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      try {
        // Explicitly setting facingMode: 'user' in constraints if exact device isn't strictly required,
        // but since we have a deviceId, we use that.
        const constraints = {
          video: { 
            deviceId: { exact: currentDeviceId },
            width: { ideal: 1280 }, 
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          }
        };

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        setStream(newStream);
        setAppState(AppState.STREAMING);
        setCameraStatus('ACTIVE');
        setTerminalLogs(prev => [...prev, "Visual feed established."]);
      } catch (err: any) {
        console.warn("Stream connection failed, retrying loose...", err);
        // Fallback
        try {
          const looseStream = await navigator.mediaDevices.getUserMedia({ 
            video: { deviceId: currentDeviceId } 
          });
          setStream(looseStream);
          setAppState(AppState.STREAMING);
          setCameraStatus('ACTIVE');
        } catch (retryErr) {
          setAppState(AppState.ERROR);
          setCameraStatus('ERROR');
          setTerminalLogs(prev => [...prev, "CRITICAL: Signal lost."]);
        }
      }
    };

    startStream();
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDeviceId]);

  const handleSwitchCamera = () => {
    if (devices.length <= 1) return;
    const currentIndex = devices.findIndex(d => d.deviceId === currentDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    if (devices[nextIndex]) {
      setTerminalLogs(prev => [...prev, `Switching to sensor ${nextIndex + 1}...`]);
      setCurrentDeviceId(devices[nextIndex].deviceId);
    }
  };

  const handleCapture = () => {
    if (!aiConnected) {
      setTerminalLogs(prev => [...prev, "CMD ERROR: AI Config Missing.", "Please check API_KEY."]);
      return;
    }
    setCaptureTrigger(prev => prev + 1);
    setAppState(AppState.ANALYZING);
    setShowTerminal(true);
    setTerminalLogs(prev => [...prev, "Capturing frame...", "Uploading to Construct..."]);
  };

  const retryConnection = () => {
    setTerminalLogs(prev => [...prev, "Re-initializing sensor subsystem..."]);
    initializeCamera();
  };

  const onFrameCaptured = async (dataUrl: string) => {
    try {
      const result = await decodeMatrixImage(dataUrl);
      if (result === "CONFIG_MISSING") {
         setTerminalLogs(prev => [...prev, ">> ERROR: API KEY NOT CONFIGURED."]);
      } else {
         setTerminalLogs(prev => [...prev, `>> ANALYSIS COMPLETE:`, result]);
      }
    } catch (e) {
      setTerminalLogs(prev => [...prev, ">> ANALYSIS FAILED: Signal corrupted."]);
    } finally {
      setAppState(AppState.STREAMING);
    }
  };

  const toggleDensity = () => {
    setDensity(prev => prev === 12 ? 8 : (prev === 8 ? 16 : 12));
    setTerminalLogs(prev => [...prev, `Grid density adjusted.`]);
  };

  const toggleMirror = () => {
    setIsMirrored(prev => !prev);
    setTerminalLogs(prev => [...prev, `Mirror mode: ${!isMirrored}`]);
  };

  return (
    <div className="relative w-screen h-screen bg-black text-green-500 overflow-hidden flex flex-col">
      {/* Main Viewport */}
      <div className="flex-1 relative z-0">
        {appState === AppState.ERROR || cameraStatus === 'ERROR' || cameraStatus === 'DENIED' ? (
          <div className="flex flex-col items-center justify-center h-full space-y-6 px-4 text-center z-20 relative bg-black/80 backdrop-blur-sm">
            <AlertTriangle size={64} className="animate-pulse text-red-500" />
            <div className="space-y-2">
              <p className="text-xl font-mono text-red-500 font-bold">SIGNAL LOST / ACCESS DENIED</p>
              <p className="text-xs opacity-70 max-w-md font-mono mx-auto">
                {cameraStatus === 'DENIED' 
                  ? "Camera permission blocked. Check browser settings."
                  : "Unable to access video device. Check connection and HTTPS."
                }
              </p>
            </div>
            
            <div className="flex gap-4">
              <button 
                onClick={retryConnection}
                className="px-6 py-2 border border-green-700 bg-green-900/20 text-green-400 rounded hover:bg-green-900/50 text-sm font-mono flex items-center gap-2"
              >
                <Power size={14} /> RECONNECT SENSORS
              </button>
              
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2 border border-red-900 bg-red-900/10 text-red-500 rounded hover:bg-red-900/30 text-sm font-mono"
              >
                SYSTEM REBOOT
              </button>
            </div>
          </div>
        ) : (
          <MatrixCanvas 
            stream={stream} 
            isActive={appState === AppState.STREAMING || appState === AppState.ANALYZING} 
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
        <div className="flex flex-col gap-2 pointer-events-auto">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tighter shadow-green-glow font-mono">MATRIX VISION</h1>
              <div className="flex items-center gap-3 text-[10px] sm:text-xs font-mono mt-1">
                <span className={`flex items-center gap-1 ${cameraStatus === 'ACTIVE' ? 'text-green-500' : 'text-red-500'}`}>
                   {cameraStatus === 'ACTIVE' ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                   CAM: {cameraStatus}
                </span>
                <span className="text-green-900">|</span>
                <span className={`flex items-center gap-1 ${aiConnected ? 'text-green-500' : 'text-yellow-600'}`}>
                   {aiConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                   AI: {aiConnected ? 'ONLINE' : 'CONFIG WAIT'}
                </span>
              </div>
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
        </div>

        {/* Center Crosshair */}
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
            <button 
              onClick={toggleDensity}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-12 h-12 rounded-full border border-green-600 bg-black/80 flex items-center justify-center group-active:scale-95 transition-all shadow-[0_0_15px_rgba(0,255,0,0.2)]">
                <Eye size={20} className="group-hover:text-white transition-colors" />
              </div>
              <span className="text-[10px] uppercase tracking-widest opacity-70 font-mono">Grid</span>
            </button>

            <button 
              onClick={toggleMirror}
              className="flex flex-col items-center gap-1 group"
            >
              <div className={`w-12 h-12 rounded-full border border-green-600 bg-black/80 flex items-center justify-center group-active:scale-95 transition-all shadow-[0_0_15px_rgba(0,255,0,0.2)] ${isMirrored ? 'bg-green-900/40 text-white' : ''}`}>
                <FlipHorizontal size={20} className="group-hover:text-white transition-colors" />
              </div>
              <span className="text-[10px] uppercase tracking-widest opacity-70 font-mono">Flip</span>
            </button>

            <button 
              onClick={handleCapture}
              disabled={appState === AppState.ANALYZING || appState === AppState.ERROR || !aiConnected}
              className={`flex flex-col items-center gap-2 group ${!aiConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className={`w-20 h-20 rounded-full border-2 ${aiConnected ? 'border-green-400 bg-green-900/20' : 'border-yellow-900 bg-black'} flex items-center justify-center group-active:scale-90 transition-all shadow-[0_0_30px_rgba(0,255,0,0.4)] relative overflow-hidden`}>
                {aiConnected && <div className="absolute inset-0 bg-green-500/10 animate-pulse"></div>}
                <Zap size={32} className={`${aiConnected ? 'text-green-400' : 'text-green-900'} ${appState === AppState.ANALYZING ? 'animate-spin' : ''}`} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-green-400 shadow-black drop-shadow-md font-mono">
                {appState === AppState.ANALYZING ? 'DECODING' : 'DECIPHER'}
              </span>
            </button>

            <button 
              onClick={handleSwitchCamera}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-12 h-12 rounded-full border border-green-600 bg-black/80 flex items-center justify-center group-active:scale-95 transition-all shadow-[0_0_15px_rgba(0,255,0,0.2)]">
                <RefreshCw size={20} className="group-hover:text-white transition-colors" />
              </div>
              <span className="text-[10px] uppercase tracking-widest opacity-70 font-mono">Cam</span>
            </button>
          </div>
        </div>
      </div>
      
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