import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { Shield, User, Landmark, Building, ChevronLeft, ChevronRight } from "lucide-react";

export const RoleSelector: React.FC = () => {
  const { user, login, logout } = useAuth();
  const { addToast } = useNotification();
  const [isOpen, setIsOpen] = useState(true);

  const roles = [
    {
      name: "Citizen (Demo)",
      username: "citizen_demo",
      password: "password123",
      role: "citizen",
      desc: "Report local defects, lock GPS positions, and view active district feeds.",
      icon: User,
      color: "bg-cyan-50 border-cyan-100 text-cyan-500"
    },
    {
      name: "Roads Officer (RND)",
      username: "officer_road",
      password: "password123",
      role: "officer",
      desc: "Track potholes & road defects, assign contractors, and resolve SLA tickets.",
      icon: Building,
      color: "bg-rose-50 border-rose-100 text-rose-500"
    },
    {
      name: "Waste Officer (WM)",
      username: "officer_waste",
      password: "password123",
      role: "officer",
      desc: "Oversee waste bins, route cleaning trucks, and audit resolved reports.",
      icon: Building,
      color: "bg-amber-50 border-amber-100 text-amber-500"
    },
    {
      name: "District Admin",
      username: "hyderabad_admin",
      password: "password123",
      role: "district_admin",
      desc: "Review Hyderabad backlog indicators, export audit logs, and oversee SLAs.",
      icon: Shield,
      color: "bg-purple-50 border-purple-100 text-purple-500"
    },
    {
      name: "State Administrator",
      username: "admin",
      password: "password123",
      role: "state_admin",
      desc: "Compare statewide regional telemetry, configure departments, and manage maps.",
      icon: Landmark,
      color: "bg-emerald-50 border-emerald-100 text-emerald-500"
    },
    {
      name: "Field Reviewer",
      username: "officer_review",
      password: "password123",
      role: "reviewer",
      desc: "Receive pending complaints, confirm by uploading a verification photo, and resolve completed reports.",
      icon: Shield,
      color: "bg-indigo-50 border-indigo-100 text-indigo-500"
    }
  ];

  const handleQuickLogin = async (username: string, password: string, roleName: string) => {
    try {
      await login(username, password);
      addToast(
        "🔑 Quick Authentication Successful",
        `Logged in as ${roleName} (${username})`,
        "success"
      );
      setIsOpen(false);
    } catch (e) {
      addToast("Authentication Error", "Quick login failed to execute.", "error");
    }
  };

  return (
    <div
      className={`fixed top-24 left-0 z-[999] transition-all duration-300 transform ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="relative flex items-start">
        {/* Sidebar Panel */}
        <div className="w-80 p-5 rounded-r-2xl border-y border-r border-slate-200/80 bg-white/95 shadow-2xl glass">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-700 text-xs tracking-wider font-mono">
              QUICK ACCESS MOCK LOGINS
            </h3>
            {user && (
              <button
                onClick={logout}
                className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 hover:bg-red-600 hover:text-white text-slate-500 border border-slate-200 transition" // impeccable-disable-line gray-on-color
              >
                Logout
              </button>
            )}
          </div>
          
          <div className="flex flex-col gap-2.5 max-h-[70vh] overflow-y-auto pr-1">
            {roles.map((item) => {
              const Icon = item.icon;
              const isActive = user?.username === item.username;
              return (
                <button
                  key={item.username}
                  onClick={() => handleQuickLogin(item.username, item.password, item.name)}
                  className={`text-left p-3 rounded-xl border transition-all duration-200 flex items-start gap-3 bg-white/70 hover:bg-slate-50/80 ${
                    isActive
                      ? "border-indigo-500 ring-1 ring-indigo-500/30"
                      : "border-slate-200/85 hover:border-slate-300"
                  }`}
                >
                  <div className={`p-2 rounded-lg border ${item.color} shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                      {item.name}
                      {isActive && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                      {item.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="text-[9px] text-slate-400 font-bold font-mono mt-4 pt-2 border-t border-slate-100 text-center uppercase tracking-wider">
            Current session: <span className="font-black text-indigo-600">{user?.role?.replace("_", " ") || "UNAUTHENTICATED"}</span>
          </div>
        </div>

        {/* Floating Toggle Tab */}
        <div className="relative flex items-center h-full">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-3 bg-white border-y border-r border-slate-200 rounded-r-xl shadow-lg hover:bg-slate-50 text-indigo-600 flex items-center justify-center transition-all duration-200"
          >
            {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {!isOpen && (
            <span className="absolute left-14 top-2 bg-indigo-600 text-white text-[10px] font-black uppercase px-3.5 py-1.5 rounded-lg shadow-lg border border-indigo-500 shadow-indigo-600/25 tracking-widest animate-pulse select-none whitespace-nowrap">
              👈 Switch Roles / Login
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
export default RoleSelector;
