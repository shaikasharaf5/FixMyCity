import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { subscribeToComplaints } from '../lib/simulationEngine';
import type { Complaint } from '../lib/simulationEngine';
import { Activity, Building, CheckCircle2, Clock, MapPin, ShieldAlert, X } from 'lucide-react';

// Custom Marker Icons based on severity/status
const createIcon = (color: string, isPulsing: boolean = false) => {
  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: `<div class="${isPulsing ? 'pulsing-marker' : ''}" style="width: 14px; height: 14px; background-color: ${color}; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 10px ${color}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

const ICONS = {
  Critical: createIcon('#f43f5e', true), // Red
  High: createIcon('#f97316'), // Orange
  Medium: createIcon('#f59e0b'), // Yellow
  Low: createIcon('#3b82f6'), // Blue
  Resolved: createIcon('#10b981') // Green
};

const formatCoordinates = (lat: number, lng: number) => `${lat.toFixed(6)}° N, ${lng.toFixed(6)}° E`;

const generateAIDescription = (complaint: Complaint) => {
  const riskTone = complaint.severity === 'Critical' ? 'critical intervention' : complaint.severity === 'High' ? 'priority follow-up' : 'standard monitoring';
  return `${complaint.description || complaint.category}. Location confidence: ${Math.round(complaint.aiConfidence)}%. Geo-anchor: ${complaint.location.address} (${formatCoordinates(complaint.location.lat, complaint.location.lng)}). Route to ${complaint.department} for ${riskTone}.`;
};

const MapFocus = ({ target }: { target: Complaint | null }) => {
  const map = useMap();
  const center = useMemo(() => (target ? [target.location.lat, target.location.lng] as [number, number] : null), [target]);

  useEffect(() => {
    if (!center) return;
    map.setView(center, 14, { animate: true });
  }, [center, map]);

  return null;
};

export const LiveCityMap: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToComplaints(setComplaints);
    return () => unsubscribe();
  }, []);

  const stats = {
    active: complaints.filter(c => !['Resolved', 'Declined'].includes(c.status)).length,
    critical: complaints.filter(c => c.severity === 'Critical' && !['Resolved', 'Declined'].includes(c.status)).length,
    inProgress: complaints.filter(c => c.status === 'In Progress').length,
    resolved: complaints.filter(c => c.status === 'Resolved').length
  };

  return (
    <div className="relative w-full h-[calc(100vh-80px)] -mt-4 page-transition-enter-active">
      
      {/* Top Floating Statistics */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[400] flex gap-4 pointer-events-none">
        <div className="glass-panel px-6 py-3 flex items-center gap-4 pointer-events-auto">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{stats.active}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Issues</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{stats.critical}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Critical</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-400">{stats.inProgress}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">In Progress</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">{stats.resolved}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resolved</div>
          </div>
        </div>
      </div>

      <MapContainer 
        center={[17.4485, 78.3741]} 
        zoom={13} 
        className="w-full h-full z-0"
        zoomControl
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
            {complaints.map(complaint => {
          const icon = complaint.status === 'Resolved' ? ICONS.Resolved : ICONS[complaint.severity];
              return (
                <Marker
                  key={complaint.id}
                  position={[complaint.location.lat, complaint.location.lng]}
                  icon={icon}
                  eventHandlers={{
                    click: () => setSelectedComplaint(complaint),
                  }}
                />
              );
            })}
          <MapFocus target={selectedComplaint} />
          </MapContainer>

      {/* Floating Panel for Selected Complaint */}
      {selectedComplaint && (
        <div className="absolute top-24 right-6 w-96 glass-panel p-0 z-[400] shadow-2xl animate-fade-in flex flex-col overflow-hidden">
          <div className={`h-2 w-full ${
            selectedComplaint.status === 'Resolved' ? 'bg-emerald-500' :
            selectedComplaint.severity === 'Critical' ? 'bg-red-500' :
            selectedComplaint.severity === 'High' ? 'bg-orange-500' :
            selectedComplaint.severity === 'Medium' ? 'bg-amber-500' : 'bg-blue-500'
          }`} />
          
          <div className="p-5 relative">
            <button 
              onClick={() => setSelectedComplaint(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">{selectedComplaint.id}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{selectedComplaint.category}</span>
            </div>
            
            <h3 className="text-xl font-bold text-white mb-4 line-clamp-2">{selectedComplaint.title}</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Severity</div>
                <div className={`text-sm font-bold flex items-center gap-1 ${
                  selectedComplaint.severity === 'Critical' ? 'text-red-400' :
                  selectedComplaint.severity === 'High' ? 'text-orange-400' :
                  selectedComplaint.severity === 'Medium' ? 'text-amber-400' : 'text-blue-400'
                }`}>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {selectedComplaint.severity}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Status</div>
                <div className={`text-sm font-bold flex items-center gap-1 ${selectedComplaint.status === 'Resolved' ? 'text-emerald-400' : 'text-slate-200'}`}>
                  {selectedComplaint.status === 'Resolved' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5 text-cyan-400" />}
                  {selectedComplaint.status}
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-white/10">
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest">Reported</div>
                  <div className="text-sm font-medium text-slate-200">
                    {Math.floor((new Date().getTime() - selectedComplaint.timestamp.getTime()) / 60000)} minutes ago
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest">Location</div>
                  <div className="text-sm font-medium text-slate-200">{selectedComplaint.location.address}</div>
                  <div className="text-xs font-mono text-cyan-300 mt-1">Exact coordinates: {formatCoordinates(selectedComplaint.location.lat, selectedComplaint.location.lng)}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest">AI Brief</div>
                <p className="text-sm text-slate-200 leading-relaxed">{generateAIDescription(selectedComplaint)}</p>
              </div>
              <div className="flex items-start gap-3">
                <Building className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest">Department</div>
                  <div className="text-sm font-medium text-slate-200">{selectedComplaint.department}</div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <button className="w-full py-2.5 bg-[#1f2937] hover:bg-[#374151] border border-slate-700 text-white text-sm font-bold rounded transition">
                View Detailed Complaint
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LiveCityMap;
