import React from "react";

export const CyberGridBg: React.FC = () => {
  return (
    <div className="cyber-grid-wrapper select-none">
      <div className="cyber-grid-3d" />
      {/* Bottom fade gradient to merge with dark workspace panels */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none" />
    </div>
  );
};

export default CyberGridBg;
