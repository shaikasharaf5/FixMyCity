import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";

// Reuse CHART_COLORS from GovDashboard or define locally
const CHART_COLORS = ["#1e3a8a", "#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#0284c7"];

const AnalyticsDashboard: React.FC<{ categoryStats: any[]; districtStats: any[]; weeklyTrendStats: any[] }> = ({ categoryStats, districtStats, weeklyTrendStats }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
      {/* Complaints by Category */}
      <div className="p-5 glass-bg shadow-lg rounded-xl">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">Complaints by Category</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categoryStats} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {categoryStats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "4px" }} itemStyle={{ color: "#e2e8f0", fontSize: "10px", fontWeight: "bold" }} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "8px", fontWeight: "bold", textTransform: "uppercase", color: "#94a3b8" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Regional Pending Comparison */}
      <div className="p-5 glass-bg shadow-lg rounded-xl">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">Regional Pending Comparison</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={districtStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: "8px", fontWeight: "bold" }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: "8px", fontWeight: "bold" }} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "4px" }} itemStyle={{ color: "#e2e8f0", fontSize: "10px", fontWeight: "bold" }} />
              <Legend wrapperStyle={{ fontSize: "8px", fontWeight: "bold", textTransform: "uppercase", color: "#94a3b8" }} />
              <Bar dataKey="Pending" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Resolved" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Critical" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly Resolution Trends */}
      <div className="p-5 glass-bg shadow-lg rounded-xl lg:col-span-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">Weekly Resolution Trends</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyTrendStats}>
              <defs>
                <linearGradient id="colorLogged" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" stroke="#94a3b8" style={{ fontSize: "8px", fontWeight: "bold" }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: "8px", fontWeight: "bold" }} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "4px" }} itemStyle={{ color: "#e2e8f0", fontSize: "10px", fontWeight: "bold" }} />
              <Legend wrapperStyle={{ fontSize: "8px", fontWeight: "bold", textTransform: "uppercase", color: "#94a3b8" }} />
              <Area type="monotone" dataKey="logged" stroke="#3b82f6" fillOpacity={1} fill="url(#colorLogged)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="resolved" stroke="#10b981" fillOpacity={1} fill="url(#colorResolved)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
