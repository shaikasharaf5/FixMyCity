import React, { useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Sparkles, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';

const mockTrendData = [
  { name: 'Mon', pothole: 12, garbage: 19, water: 3 },
  { name: 'Tue', pothole: 15, garbage: 14, water: 5 },
  { name: 'Wed', pothole: 28, garbage: 22, water: 12 },
  { name: 'Thu', pothole: 18, garbage: 25, water: 8 },
  { name: 'Fri', pothole: 23, garbage: 18, water: 4 },
  { name: 'Sat', pothole: 34, garbage: 30, water: 15 },
  { name: 'Sun', pothole: 29, garbage: 24, water: 9 },
];

const mockMonthlyTrendData = [
  { name: 'Week 1', pothole: 82, garbage: 90, water: 43 },
  { name: 'Week 2', pothole: 95, garbage: 114, water: 55 },
  { name: 'Week 3', pothole: 128, garbage: 92, water: 62 },
  { name: 'Week 4', pothole: 118, garbage: 125, water: 48 },
];

const mockDeptData = [
  { name: 'Roads', value: 85 },
  { name: 'Sanitation', value: 92 },
  { name: 'Water', value: 78 },
  { name: 'Power', value: 95 },
];

interface AnalyticsInsightsProps {
  onNavigate?: (tab: string) => void;
}

export const AnalyticsInsights: React.FC<AnalyticsInsightsProps> = ({ onNavigate }) => {
  const [timeRange, setTimeRange] = useState<'Weekly' | 'Monthly'>('Weekly');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const trendData = timeRange === 'Weekly' ? mockTrendData : mockMonthlyTrendData;

  const handleSchedule = () => {
    setToastMessage("Preventive resurfacing scheduled successfully.");
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto page-transition-enter-active relative">
      
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-500/90 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> {toastMessage}
        </div>
      )}
      
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">AI City Intelligence</h1>
          <p className="text-violet-400 font-medium">Predictive analytics and automated insights</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setTimeRange('Weekly')}
             className={`px-4 py-2 text-sm font-semibold rounded transition ${timeRange === 'Weekly' ? 'bg-violet-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]' : 'bg-[#1f2937] text-slate-300 hover:bg-slate-700'}`}
             aria-pressed={timeRange === 'Weekly'}
           >
             Weekly
           </button>
           <button 
             onClick={() => setTimeRange('Monthly')}
             className={`px-4 py-2 text-sm font-semibold rounded transition ${timeRange === 'Monthly' ? 'bg-violet-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]' : 'bg-[#1f2937] text-slate-300 hover:bg-slate-700'}`}
             aria-pressed={timeRange === 'Monthly'}
           >
             Monthly
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Charts */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-panel p-6 border border-white/5">
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider">Issue Volume Trends</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorPothole" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorGarbage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="name" stroke="#6b7280" tick={{fill: '#9ca3af', fontSize: 12}} />
                  <YAxis stroke="#6b7280" tick={{fill: '#9ca3af', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6' }}
                    itemStyle={{ color: '#f3f4f6' }}
                  />
                  <Area type="monotone" dataKey="pothole" stroke="#f43f5e" fillOpacity={1} fill="url(#colorPothole)" strokeWidth={2} />
                  <Area type="monotone" dataKey="garbage" stroke="#f59e0b" fillOpacity={1} fill="url(#colorGarbage)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="glass-panel p-6 border border-white/5">
              <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider">Department Resolution Rate</h3>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mockDeptData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="name" stroke="#6b7280" tick={{fill: '#9ca3af', fontSize: 11}} />
                    <Tooltip cursor={{fill: '#1f2937'}} contentStyle={{ backgroundColor: '#111827', borderColor: '#374151' }} />
                    <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Predictive Maintenance Widget */}
            <div className="glass-panel p-6 border border-violet-500/20 bg-violet-950/10 flex flex-col">
              <h3 className="text-sm font-bold text-violet-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4" /> Predictive Maintenance
              </h3>
              
              <div className="flex-1 flex flex-col justify-center gap-4">
                <div className="bg-[#111827] p-4 rounded-lg border border-red-500/20">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-400 font-bold uppercase">Road Failure Risk</span>
                    <span className="text-xs font-bold text-red-400 bg-red-400/10 px-2 rounded">87% RISK</span>
                  </div>
                  <div className="text-sm text-white font-medium">Miyapur–KPHB Corridor</div>
                  <div className="text-xs text-slate-500 mt-2">Expected degradation: <span className="text-slate-300">14–21 days</span></div>
                  <button onClick={handleSchedule} className="w-full mt-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-bold rounded hover:bg-red-500/30 transition focus:outline-none focus:ring-2 focus:ring-red-500" aria-label="Schedule Preventive Resurfacing">
                    Schedule Preventive Resurfacing
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: AI Generated Insights Feed */}
        <div className="glass-panel flex flex-col overflow-hidden border border-white/5">
          <div className="p-5 border-b border-white/5 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Automated Insights</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            
            <div className="p-4 bg-[#111827] border border-orange-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Abnormal Growth</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed mb-3">
                "Three major roads in Ward 14 show a 42% week-over-week increase in pothole formation, likely due to recent heavy rainfall combined with heavy vehicle traffic."
              </p>
              <div className="flex items-center justify-between text-xs">
                 <span className="text-slate-500">Confidence: <span className="text-emerald-400 font-mono">94%</span></span>
                 <button onClick={() => { if (onNavigate) onNavigate('agents'); }} className="text-cyan-400 hover:text-cyan-300 font-semibold">Take Action &rarr;</button>
              </div>
            </div>

            <div className="p-4 bg-[#111827] border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Performance Improvement</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed mb-3">
                "Department response time for Sanitation has improved by 17% this month. The new routing algorithm is successfully reducing transit times."
              </p>
              <div className="flex items-center justify-between text-xs">
                 <span className="text-slate-500">Impact: <span className="text-emerald-400 font-mono">High</span></span>
                 <button onClick={() => { if (onNavigate) onNavigate('gov'); }} className="text-cyan-400 hover:text-cyan-300 font-semibold">View Report &rarr;</button>
              </div>
            </div>

            <div className="p-4 bg-[#111827] border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Elevated Risk</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed mb-3">
                "Flood risk is critically elevated around Sector 7 due to 3 unresolved drainage blocks. Immediate clearance required before weekend storm."
              </p>
              <div className="flex items-center justify-between text-xs">
                 <span className="text-slate-500">Confidence: <span className="text-emerald-400 font-mono">89%</span></span>
                 <button onClick={() => { if (onNavigate) onNavigate('gov'); }} className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition font-semibold">Dispatch Team</button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default AnalyticsInsights;
