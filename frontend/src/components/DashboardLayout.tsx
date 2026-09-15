import React from "react";

// DashboardLayout provides a dark-gradient background with a centered glass‑morphic container.
// Children are rendered inside the glass panel. Optional "nav" prop can render side navigation.

interface DashboardLayoutProps {
  children: React.ReactNode;
  /** Optional left navigation component */
  nav?: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, nav }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] flex items-center justify-center p-4">
      <div className="relative w-full max-w-7xl glass-bg-dark p-6 rounded-xl shadow-xl">
        {nav && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Placeholder for future side navigation – keep layout flexible */}
          </div>
        )}
        <div className="relative animate-fade-in">
          {children}
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
