import React, { useRef, useEffect, useCallback } from 'react';

interface MatrixCanvasProps {
  stream: MediaStream | null;
  isActive: boolean;
  onFrameCapture?: (dataUrl: string) => void;
  captureTrigger?: number;
  density?: number;
  isMirrored?: boolean;
}

// 5-Tier Bucket System for better depth perception
const BUCKETS = {
  GLOW:   { color: '#EEFFEE', alpha: 1.0,  threshold: 240, glow: 15, glowColor: '#00FF00' }, // Highlights
  BRIGHT: { color: '#00FF41', alpha: 0.95, threshold: 160, glow: 0,  glowColor: '' },        // Subject
  MID:    { color: '#00D200', alpha: 0.75, threshold: 90,  glow: 0,  glowColor: '' },        // Midtones
  LOW:    { color: '#007500', alpha: 0.40, threshold: 40,  glow: 0,  glowColor: '' },        // Shadows
  DIM:    { color: '#003300', alpha: 0.15, threshold: 10,  glow: 0,  glowColor: '' }         // Background
};

const MatrixCanvas: React.FC<MatrixCanvasProps> = ({ 
  stream, 
  isActive, 
  onFrameCapture, 
  captureTrigger,
  density = 12,
  isMirrored = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const smallCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const animationRef = useRef<number>(0);
  const lastDrawTimeRef = useRef<number>(0);
  
  const chars = "ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ012345789:・.=\"*+-<>¦｜";
  const TARGET_FPS = 30;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;

  const processFrame = useCallback((timestamp: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || !isActive) return;
    
    const elapsed = timestamp - lastDrawTimeRef.current;
    if (elapsed < FRAME_INTERVAL) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }
    lastDrawTimeRef.current = timestamp - (elapsed % FRAME_INTERVAL);

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const rect = canvas.getBoundingClientRect();
      // Cap DPR at 2.0 to prevent performance issues on high-density mobile screens (iPhone, etc.)
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      
      const displayWidth = Math.floor(rect.width);
      const displayHeight = Math.floor(rect.height);
      
      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        ctx.scale(dpr, dpr);
      }

      // -- OFFSCREEN PROCESSING --
      const fontSize = density; 
      const cols = Math.floor(displayWidth / fontSize);
      const rows = Math.floor(displayHeight / fontSize);
      
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

      smallCtx.drawImage(video, 0, 0, cols, rows);
      
      const frameData = smallCtx.getImageData(0, 0, cols, rows);
      const pixels = frameData.data;

      // -- RENDERING --
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, displayWidth, displayHeight);

      ctx.font = `${fontSize}px 'Share Tech Mono', monospace`;
      ctx.textBaseline = 'top';

      const batches: Record<keyof typeof BUCKETS, {x: number, y: number, char: string}[]> = {
        GLOW: [], BRIGHT: [], MID: [], LOW: [], DIM: []
      };

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const index = (y * cols + x) * 4;
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          
          let luma = 0.299 * r + 0.587 * g + 0.114 * b;
          
          const normalized = luma / 255;
          const contrast = (normalized * normalized) * 255 * 1.2;

          if (contrast < BUCKETS.DIM.threshold) continue;

          const char = chars[Math.floor(Math.random() * chars.length)];
          
          const drawX = isMirrored ? (cols - 1 - x) * fontSize : x * fontSize;
          const drawY = y * fontSize;

          if (contrast > BUCKETS.GLOW.threshold) batches.GLOW.push({ x: drawX, y: drawY, char });
          else if (contrast > BUCKETS.BRIGHT.threshold) batches.BRIGHT.push({ x: drawX, y: drawY, char });
          else if (contrast > BUCKETS.MID.threshold) batches.MID.push({ x: drawX, y: drawY, char });
          else if (contrast > BUCKETS.LOW.threshold) batches.LOW.push({ x: drawX, y: drawY, char });
          else batches.DIM.push({ x: drawX, y: drawY, char });
        }
      }

      if (batches.DIM.length) {
        ctx.fillStyle = BUCKETS.DIM.color;
        ctx.globalAlpha = BUCKETS.DIM.alpha;
        for (const p of batches.DIM) ctx.fillText(p.char, p.x, p.y);
      }
      if (batches.LOW.length) {
        ctx.fillStyle = BUCKETS.LOW.color;
        ctx.globalAlpha = BUCKETS.LOW.alpha;
        for (const p of batches.LOW) ctx.fillText(p.char, p.x, p.y);
      }
      if (batches.MID.length) {
        ctx.fillStyle = BUCKETS.MID.color;
        ctx.globalAlpha = BUCKETS.MID.alpha;
        for (const p of batches.MID) ctx.fillText(p.char, p.x, p.y);
      }
      if (batches.BRIGHT.length) {
        ctx.fillStyle = BUCKETS.BRIGHT.color;
        ctx.globalAlpha = BUCKETS.BRIGHT.alpha;
        for (const p of batches.BRIGHT) ctx.fillText(p.char, p.x, p.y);
      }
      if (batches.GLOW.length) {
        ctx.fillStyle = BUCKETS.GLOW.color;
        ctx.globalAlpha = BUCKETS.GLOW.alpha;
        ctx.shadowColor = BUCKETS.GLOW.glowColor;
        ctx.shadowBlur = BUCKETS.GLOW.glow;
        for (const p of batches.GLOW) ctx.fillText(p.char, p.x, p.y);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1.0;
    }

    animationRef.current = requestAnimationFrame(processFrame);
  }, [isActive, density, chars, FRAME_INTERVAL, isMirrored]);

  useEffect(() => {
    if (captureTrigger && captureTrigger > 0 && canvasRef.current && onFrameCapture) {
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);
      onFrameCapture(dataUrl);
    }
  }, [captureTrigger, onFrameCapture]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Video play error:", e));
    }
  }, [stream]);

  useEffect(() => {
    if (isActive) {
      animationRef.current = requestAnimationFrame(processFrame);
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
        autoPlay
        className="absolute opacity-0 pointer-events-none"
        style={{ width: 1, height: 1 }}
      />
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.9)]"></div>
    </div>
  );
};

export default MatrixCanvas;