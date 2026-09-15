import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";

interface MapViewProps {
  complaints: any[];
  selectedComplaint?: any | null;
  onSelectComplaint?: (complaint: any) => void;
  center?: [number, number];
  zoom?: number;
}

export const MapView: React.FC<MapViewProps> = ({
  complaints,
  selectedComplaint,
  onSelectComplaint,
  center = [17.4485, 78.3741],
  zoom = 12,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const markersRef = useRef<any[]>([]);
  const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character] || character));

  // Helper to resolve pin colors based on classification
  const getMarkerColor = (category: string, status: string) => {
    if (status === "resolved") {
      return "#22c55e"; // Green for completed fixes
    }
    switch (category) {
      case "Water Leakage":
      case "Flooded Road":
        return "#3b82f6"; // Blue
      case "Garbage":
        return "#eab308"; // Yellow
      case "Electric Pole Damage":
      case "Broken Streetlight":
        return "#06b6d4"; // Cyan
      case "Open Manhole":
        return "#a855f7"; // Purple
      default:
        return "#ef4444"; // Red for potholes / general
    }
  };

  // 1. Initialize Map Object
  useEffect(() => {
    if (!mapRef.current) return;
    
    let mapInstance: any = null;
    try {
      mapInstance = L.map(mapRef.current).setView([center[0], center[1]], zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(mapInstance);
      setMap(mapInstance);
      setTimeout(() => mapInstance.invalidateSize(), 200);
    } catch (err) {
      console.error("Failed to initialize Leaflet Map:", err);
    }

    return () => {
      if (mapInstance) {
        mapInstance.remove();
        setMap(null);
      }
    };
  }, []);

  // 2. Render Markers when complaints change
  useEffect(() => {
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    complaints.forEach((complaint) => {
      try {
        const color = getMarkerColor(complaint.category, complaint.status);
        
        // Leaflet DivIcon for custom colored SVG marker
        const customIcon = L.divIcon({
          className: "custom-leaflet-marker",
          html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}" stroke="#020617" stroke-width="1.5"/></svg>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -30]
        });

        const marker = L.marker([complaint.latitude, complaint.longitude], { icon: customIcon }).addTo(map);

        const popupContent = `
          <div style="color: #0f172a; padding: 4px; max-width: 220px; font-family: system-ui, sans-serif;">
            <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: ${color}; letter-spacing: 0.05em;">
              ${escapeHtml(complaint.category)}
            </div>
            <div style="font-size: 11px; margin-top: 4px; color: #334155; line-height: 1.4;">
              ${escapeHtml(complaint.description)}
            </div>
            <div style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 4px; font-size: 9px; color: #64748b; font-weight: bold; text-transform: uppercase;">
              Ward: ${escapeHtml(complaint.ward)} | ${escapeHtml(complaint.status.replace("_", " "))}
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);

        marker.on("click", () => {
          if (onSelectComplaint) {
            onSelectComplaint(complaint);
          }
        });

        markersRef.current.push(marker);
      } catch (err) {
        console.error("Error creating marker:", err);
      }
    });

    try {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    } catch (e) {}
  }, [map, complaints]);

  // 3. Center Camera on filter changes
  useEffect(() => {
    if (!map) return;
    try {
      map.setView([center[0], center[1]], zoom);
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    } catch (e) {}
  }, [center, map, zoom]);

  // 4. Center Camera on selected complaint
  useEffect(() => {
    if (!map || !selectedComplaint) return;
    try {
      map.setView([selectedComplaint.latitude, selectedComplaint.longitude], 15);
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    } catch (e) {}
  }, [selectedComplaint, map]);

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-[#0f172a] min-h-[400px]">
      <div ref={mapRef} className="w-full h-full z-0 absolute inset-0" style={{ height: "100%", width: "100%" }} />
    </div>
  );
};

export default MapView;
