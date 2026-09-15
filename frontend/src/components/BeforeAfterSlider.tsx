import React, { useState, useRef } from "react";
import { Sparkles } from "lucide-react";

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  heightClass?: string;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  beforeImage,
  afterImage,
  heightClass = "h-80"
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse path to full URL
  const getFullUrl = (path: string) => {
    if (!path) return "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=600"; // fallback
    if (path.startsWith("http")) return path;
    const API_URL = window.location.protocol + "//" + window.location.hostname + ":8001";
    return `${API_URL}${path}`;
  };

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(position);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  return (
    <div className="flex flex-col gap-2">
      <div 
        ref={containerRef}
        className={`slider-container relative w-full ${heightClass} rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner`}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onMouseMove={handleMouseMove}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={() => setIsDragging(false)}
        onTouchMove={handleTouchMove}
      >
        {/* Before Image (Background) */}
        <img 
          src={getFullUrl(beforeImage)} 
          alt="Before Repair"
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
        />
        <div className="absolute top-3 left-3 z-30 bg-slate-900/80 border border-slate-700/50 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-red-400">
          Before Repair
        </div>

        {/* After Image (Overlay Width Controlled) */}
        <div 
          className="absolute inset-y-0 left-0 overflow-hidden select-none pointer-events-none z-20"
          style={{ width: `${sliderPosition}%` }}
        >
          <img 
            src={getFullUrl(afterImage)} 
            alt="After Repair"
            className="absolute inset-0 w-full h-full object-cover select-none max-w-none"
            style={{ 
              width: containerRef.current ? containerRef.current.getBoundingClientRect().width : "100%",
              height: containerRef.current ? containerRef.current.getBoundingClientRect().height : "100%"
            }}
          />
          <div className="absolute top-3 right-3 bg-gov-accent/90 border border-gov-accent/50 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-slate-100 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-yellow-300 animate-spin" /> Resolved
          </div>
        </div>

        {/* Drag Bar & Handle */}
        <div 
          className="absolute inset-y-0 z-30 w-1 bg-white cursor-ew-resize select-none"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center shadow-lg cursor-ew-resize select-none">
            <div className="flex gap-0.5 text-white text-xs select-none">
              <span>‹</span>
              <span>›</span>
            </div>
          </div>
        </div>
      </div>
      <div className="text-[10px] text-center text-slate-500 italic">
        Drag the center slider to inspect repair quality
      </div>
    </div>
  );
};
export default BeforeAfterSlider;
