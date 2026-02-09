import React, { useRef, useEffect, useCallback } from 'react';

interface MatrixCanvasProps {
  stream: MediaStream | null;
  isActive: boolean;
  onFrameCapture?: (dataUrl: string) => void;
  captureTrigger?: number; // Increment to trigger capture
  density?: number;
  isMirrored?: boolean;
}

const MatrixCanvas: React.FC<MatrixCanvasProps> = ({ 
  stream, 
  isActive, 
  onFrameCapture, 
  captureTrigger,
  density = 14,
  isMirrored = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Optimization: Reuse the offscreen canvas to prevent garbage collection stutter
  const smallCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const animationRef = useRef<number>();
  const lastDrawTimeRef = useRef<number>(0);
  
  // Characters to use for the matrix
  const chars = "ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ012345789Z:・.=\"*+-<>¦｜";
  
  // Target FPS for the matrix effect. 
  const TARGET_FPS = 24; 
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  const processFrame = useCallback((timestamp: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || !isActive) return;
    
    // Throttling Logic
    const elapsed = timestamp - lastDrawTimeRef.current;
    if (elapsed < FRAME_INTERVAL) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }
    // Adjust for latency
    lastDrawTimeRef.current = timestamp - (elapsed % FRAME_INTERVAL);

    const ctx = canvas.getContext('2d', { alpha: false }); // alpha: false can improve perf
    if (!ctx) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      // 1. Setup Main Canvas Dimensions
      const rect = canvas.getBoundingClientRect();
      const displayWidth = rect.width;
      const displayHeight = rect.height;
      const dpr = window.devicePixelRatio || 1;
      
      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        ctx.scale(dpr, dpr);
      }

      // 2. Setup Offscreen Canvas (Grid Resolution)
      const fontSize = density; 
      const cols = Math.floor(displayWidth / fontSize);
      const rows = Math.floor(displayHeight / fontSize);
      
      // Initialize or resize offscreen canvas only when needed
      if (!smallCanvasRef.current) {
        smallCanvasRef.current = document.createElement('canvas');
      }
      const smallCanvas = smallCanvasRef.current;
      
      if (smallCanvas.width !== cols || smallCanvas.height !== rows) {
        smallCanvas.width = cols;
        smallCanvas.height = rows;
      }
      
      const smallCtx = smallCanvas.getContext('2d', { willReadFrequently: true });
      if (!smallCtx) return;

      // 3. Draw Video to Offscreen Canvas (Downsampling)
      smallCtx.drawImage(video, 0, 0, cols, rows);
      
      // 4. Get Pixel Data
      const frameData = smallCtx.getImageData(0, 0, cols, rows);
      const pixels = frameData.data;

      // 5. Clear Main Canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, displayWidth, displayHeight);

      ctx.font = `${fontSize}px 'Share Tech Mono', monospace`;
      ctx.textBaseline = 'top';

      // 6. Draw Characters
      // We iterate through the grid. If mirrored, we flip the X coordinate drawing position.
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const index = (y * cols + x) * 4;
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          
          // Luma
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          
          if (brightness < 20) continue;

          // Determine color
          let fillStyle = '';
          if (brightness > 200) {
            fillStyle = `rgba(200, 255, 200, 0.95)`;
          } else if (brightness > 100) {
            fillStyle = `rgba(0, 255, 65, ${brightness / 255})`;
          } else {
            fillStyle = `rgba(0, 100, 0, ${brightness / 255})`;
          }

          const charIndex = Math.floor(Math.random() * chars.length);
          const char = chars[charIndex];

          ctx.fillStyle = fillStyle;

          // Mirroring Logic:
          // If mirrored, we draw the character at the opposite X position.
          // Note: We do NOT scale the context (-1, 1) because that would make text backwards.
          // We want the SCENE mirrored, but the CODE readable.
          const drawX = isMirrored ? (cols - 1 - x) * fontSize : x * fontSize;
          const drawY = y * fontSize;

          ctx.fillText(char, drawX, drawY);
        }
      }
    }

    animationRef.current = requestAnimationFrame(processFrame);
  }, [isActive, density, chars, FRAME_INTERVAL, isMirrored]);

  // Handle capture trigger
  useEffect(() => {
    if (captureTrigger && captureTrigger > 0 && canvasRef.current && onFrameCapture) {
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.85);
      onFrameCapture(dataUrl);
    }
  }, [captureTrigger, onFrameCapture]);

  // Handle Stream Setup
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Video play error:", e));
    }
  }, [stream]);

  // Handle Animation Loop
  useEffect(() => {
    if (isActive) {
      animationRef.current = requestAnimationFrame(processFrame);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, processFrame]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute opacity-0 pointer-events-none w-0 h-0" 
      />
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover"
        // Removed CSS transform to improve performance and keep text orientation correct
      />
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.9)]"></div>
    </div>
  );
};

export default MatrixCanvas;