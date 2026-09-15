import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { API_URL } from "../services/api";

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

export interface CommunityAlertData {
  id: number;
  title: string;
  content: string;
  category: string;
  contact_info?: string;
  image_url?: string;
  created_at?: string;
  username?: string;
}

interface NotificationContextType {
  notifications: ToastMessage[];
  addToast: (title: string, message: string, type?: ToastMessage["type"]) => void;
  removeToast: (id: string) => void;
  activeAlert: CommunityAlertData | null;
  clearActiveAlert: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Web Audio API Synthesized Chime
const playChime = (isUrgent: boolean = false) => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = isUrgent ? "sawtooth" : "sine";
    osc1.frequency.setValueAtTime(isUrgent ? 987.77 : 880, ctx.currentTime);
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.45);

    // Second double-tap pitch tone
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = isUrgent ? "sawtooth" : "sine";
      osc2.frequency.setValueAtTime(isUrgent ? 1318.51 : 1046.5, ctx.currentTime);
      gain2.gain.setValueAtTime(0.15, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.55);
    }, 150);

  } catch (e) {
    console.warn("Web Audio API not allowed yet by browser autoplay policy:", e);
  }
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<ToastMessage[]>([]);
  const [activeAlert, setActiveAlert] = useState<CommunityAlertData | null>(null);

  const addToast = useCallback((title: string, message: string, type: ToastMessage["type"] = "info") => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications((prev) => [...prev, { id, title, message, type }]);
    playChime(type === "error");
    
    // Auto-remove toast after 6 seconds
    setTimeout(() => {
      removeToast(id);
    }, 6000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearActiveAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  // WebSockets setup
  useEffect(() => {
    if (!user) return;

    let ws: WebSocket;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "127.0.0.1:8001"
      : "nonconductible-michele-genitally.ngrok-free.dev";
    const wsUrl = `${protocol}//${wsHost}/ws/${user.id}/${user.role}?district=Hyderabad&department_id=1`;

    const connectWS = () => {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          if (event.data === "pong") return;
          const payload = JSON.parse(event.data);
          
          if (payload.type === "NEW_COMPLAINT") {
            const complaint = payload.data;
            addToast(
              `🚨 New ${complaint.category} Filed!`,
              `A new ${complaint.severity.toUpperCase()} issue was uploaded in ${complaint.district} (Ward: ${complaint.ward}). Routing to assigned department.`,
              complaint.severity === "critical" || complaint.severity === "high" ? "error" : "warning"
            );
          } else if (payload.type === "COMPLAINT_STATUS_UPDATE") {
            const complaint = payload.data;
            addToast(
              `📋 Ticket Status Update`,
              `Your complaint #${complaint.id} (${complaint.category}) status updated to: ${complaint.status.toUpperCase()}`,
              "success"
            );
          } else if (payload.type === "COMMUNITY_ALERT_BROADCAST") {
            const alertData: CommunityAlertData = payload.data;
            setActiveAlert(alertData);
            playChime(true);
            addToast(
              `🚨 BROADCAST ALERT: ${alertData.title}`,
              `Emergency community notice broadcasted to all citizens!`,
              "error"
            );
          }
        } catch (err) {
          console.error("Error parsing WebSocket event:", err);
        }
      };

      ws.onopen = () => {
        console.log("WebSocket connected successfully for CivicSense notification relay.");
        // Ping every 30 seconds to keep connection alive
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 30000);
        (ws as any).pingInterval = pingInterval;
      };

      ws.onclose = (event) => {
        console.warn("WebSocket disconnected. Reconnecting in 5 seconds...", event.reason);
        if ((ws as any).pingInterval) {
          clearInterval((ws as any).pingInterval);
        }
        setTimeout(connectWS, 5000);
      };

      ws.onerror = (err) => {
        console.error("WebSocket connection failure:", err);
        ws.close();
      };
    };

    connectWS();

    return () => {
      if (ws) {
        if ((ws as any).pingInterval) {
          clearInterval((ws as any).pingInterval);
        }
        ws.close();
      }
    };
  }, [user, addToast]);

  return (
    <NotificationContext.Provider value={{ notifications, addToast, removeToast, activeAlert, clearActiveAlert }}>
      {children}
      
      {/* REAL-TIME COMMUNITY BROADCAST ALERT MODAL WITH PHOTO */}
      {activeAlert && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white border-2 border-red-500 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
            {/* Top Alert Bar */}
            <div className="bg-red-600 px-5 py-3 text-white flex items-center justify-between font-black uppercase text-xs tracking-wider shadow-md">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                🚨 EMERGENCY BROADCAST ALERT TO ALL USERS
              </span>
              <button 
                onClick={clearActiveAlert}
                className="text-white/80 hover:text-white font-mono text-base px-2 py-0.5 rounded hover:bg-red-700 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-4 text-left">
              {/* Photo Display */}
              {activeAlert.image_url ? (
                <div className="w-full h-52 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-inner relative flex items-center justify-center">
                  <img 
                    src={activeAlert.image_url.startsWith("http") ? activeAlert.image_url : `${API_URL}${activeAlert.image_url}`} 
                    alt="Alert attachment photo" 
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2.5 left-2.5 bg-red-600 text-white px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider shadow">
                    {activeAlert.category.replace("_", " ")}
                  </span>
                </div>
              ) : (
                <div className="w-full h-36 bg-red-50 border border-red-200 rounded-xl flex items-center justify-center text-red-600 font-black text-xs uppercase tracking-wider">
                  🚨 {activeAlert.category.replace("_", " ")}
                </div>
              )}

              {/* Title & Description */}
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wide leading-tight">
                  {activeAlert.title}
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed font-semibold">
                  {activeAlert.content}
                </p>
              </div>

              {/* Contact info card if available */}
              {activeAlert.contact_info && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                  <span className="text-[9px] text-amber-700 font-extrabold uppercase tracking-wider">Contact Info:</span>
                  <span className="text-xs font-black text-amber-900 font-mono">{activeAlert.contact_info}</span>
                </div>
              )}

              {/* Footer Button */}
              <button
                onClick={clearActiveAlert}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold uppercase tracking-wider py-3 rounded-xl text-xs shadow-md transition"
              >
                Acknowledge & Close Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert Render Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full">
        {notifications.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl border glass-panel glow-blue transition-all duration-300 transform translate-y-0 flex flex-col relative overflow-hidden`}
          >
            {/* Ambient accent background line */}
            <div
              className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                toast.type === "error"
                  ? "bg-red-500"
                  : toast.type === "warning"
                  ? "bg-yellow-500"
                  : toast.type === "success"
                  ? "bg-green-500"
                  : "bg-cyan-500"
              }`}
            />
            
            <div className="pl-2 flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                  {toast.title}
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {toast.message}
                </p>
              </div>
              
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-500 hover:text-slate-300 text-xs p-1"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
};

