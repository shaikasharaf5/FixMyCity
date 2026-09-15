import { useState, useRef, useCallback } from 'react';
import type { MouseEvent } from 'react';

interface TiltConfig {
  maxTilt?: number; // max tilt in degrees (default: 15)
  scale?: number; // zoom on hover (default: 1.05)
  glare?: boolean; // enable glare effect (default: false)
}

export const use3dTilt = ({ maxTilt = 15, scale = 1.02, glare = false }: TiltConfig = {}) => {
  const [style, setStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!ref.current) return;

      const rect = ref.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Mouse position relative to the element
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate rotation (center is 0)
      const rotateY = ((mouseX / width) - 0.5) * (maxTilt * 2);
      const rotateX = ((mouseY / height) - 0.5) * -(maxTilt * 2);

      let newStyle: React.CSSProperties = {
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`,
        transition: 'transform 0.1s ease-out',
        willChange: 'transform',
      };

      if (glare) {
        // Add a soft glare effect
        const glareX = (mouseX / width) * 100;
        const glareY = (mouseY / height) * 100;
        newStyle.backgroundImage = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.1) 0%, transparent 60%)`;
      }

      setStyle(newStyle);
    },
    [maxTilt, scale, glare]
  );

  const handleMouseLeave = useCallback(() => {
    setStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 0.5s ease-out',
      backgroundImage: 'none',
    });
  }, []);

  return { ref, style, handleMouseMove, handleMouseLeave };
};
