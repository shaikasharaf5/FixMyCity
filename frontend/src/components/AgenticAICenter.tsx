import React from 'react';
import { Bot, Eye, MapPin, AlertTriangle, Route, Copy, ArrowUpCircle, Lightbulb, Activity, ArrowDown, CheckCircle } from 'lucide-react';
import { use3dTilt } from '../hooks/use3dTilt';

const AGENTS = [
  { id: 'vision', name: 'Vision Agent', icon: Eye, desc: 'Detects civic issues from images.', tasks: '12,482', success: '98.4%', last: '2s ago' },
  { id: 'location', name: 'Location Agent', icon: MapPin, desc: 'Identifies exact geographic location.', tasks: '11,940', success: '99.1%', last: '2s ago' },
  { id: 'severity', name: 'Severity Agent', icon: AlertTriangle, desc: 'Determines urgency and risk.', tasks: '12,482', success: '95.8%', last: '1s ago' },
  { id: 'routing', name: 'Routing Agent', icon: Route, desc: 'Assigns complaints to departments.', tasks: '10,210', success: '99.9%', last: '1s ago' },
  { id: 'duplicate', name: 'Duplicate Agent', icon: Copy, desc: 'Finds duplicate complaints.', tasks: '24,500', success: '97.2%', last: '5s ago' },
  { id: 'escalation', name: 'Escalation Agent', icon: ArrowUpCircle, desc: 'Escalates delayed complaints.', tasks: '4,102', success: '100%', last: '4m ago' },
  { id: 'insight', name: 'Insight Agent', icon: Lightbulb, desc: 'Generates city intelligence.', tasks: '1,024', success: '94.5%', last: '12m ago' },
];

export const AgenticAICenter: React.FC = () => {
  const tilt1 = use3dTilt({ maxTilt: 15, scale: 1.05 });
  const tilt2 = use3dTilt({ maxTilt: 15, scale: 1.05 });
  const tilt3 = use3dTilt({ maxTilt: 15, scale: 1.05 });
  const tilt4 = use3dTilt({ maxTilt: 15, scale: 1.05 });
  const tilt5 = use3dTilt({ maxTilt: 15, scale: 1.05 });
  const tilt6 = use3dTilt({ maxTilt: 15, scale: 1.05 });
  const tilt7 = use3dTilt({ maxTilt: 15, scale: 1.05 });
  
  const tilts = [tilt1, tilt2, tilt3, tilt4, tilt5, tilt6, tilt7];

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1600px] mx-auto page-transition-enter-active">
      
      <div className="mb-2">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <Bot className="w-8 h-8 text-cyan-400" /> CiviTrack AI Agents
        </h1>
        <p className="text-cyan-400 font-medium text-lg mt-1">
          AI that doesn't just analyze problems. <span className="text-white">It takes action.</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* AGENT GRID */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4 perspective-1000">
          {AGENTS.map((agent, index) => {
            const tilt = tilts[index];
            return (
            <div 
              key={agent.id} 
              ref={tilt.ref as React.RefObject<HTMLDivElement>} style={tilt.style} onMouseMove={tilt.handleMouseMove} onMouseLeave={tilt.handleMouseLeave}
              className="glass-panel p-5 border border-white/5 hover:border-cyan-500/30 transition-colors group relative overflow-hidden cursor-default"
            >
              {/* Animated scanning bg on hover */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent -translate-y-full group-hover:animate-[scan-vertical_2s_ease-in-out_infinite]" />
              
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#111827] rounded-lg border border-white/10 group-hover:border-cyan-500/50 transition-colors">
                    <agent.icon className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{agent.name}</h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      ACTIVE
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 mb-5 relative z-10">{agent.desc}</p>

              <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-4 relative z-10">
                <div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Processed</div>
                  <div className="text-sm font-bold text-slate-200">{agent.tasks}</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Success</div>
                  <div className="text-sm font-bold text-emerald-400">{agent.success}</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Last Action</div>
                  <div className="text-sm font-bold text-cyan-400">{agent.last}</div>
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {/* LIVE ACTIVITY FEED */}
        <div className="lg:col-span-4 glass-panel flex flex-col overflow-hidden border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
          <div className="p-5 border-b border-white/5 bg-cyan-950/20 flex items-center justify-between">
            <h2 className="text-sm font-bold text-cyan-400 flex items-center gap-2 uppercase tracking-wider">
              <Activity className="w-4 h-4" /> Live Agent Graph
            </h2>
            <div className="text-[10px] font-mono text-cyan-500">REAL-TIME</div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col relative">
             {/* Connecting Line */}
             <div className="absolute left-[39px] top-10 bottom-10 w-0.5 bg-cyan-900/50 z-0" />

             {/* Feed Items */}
             <div className="relative z-10 flex flex-col gap-6">
                
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-cyan-950 border border-cyan-500/50 flex items-center justify-center shrink-0">
                    <Eye className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="bg-[#111827] p-3 rounded-lg border border-white/5 w-full">
                    <span className="text-xs font-bold text-cyan-400 block mb-1">Vision Agent</span>
                    <p className="text-sm text-slate-300">Detected <span className="text-white font-semibold">Pothole</span> from image upload (ID: CS-8812)</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-amber-950 border border-amber-500/50 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="bg-[#111827] p-3 rounded-lg border border-white/5 w-full">
                    <span className="text-xs font-bold text-amber-400 block mb-1">Severity Agent</span>
                    <p className="text-sm text-slate-300">Classified issue as <span className="text-white font-semibold uppercase bg-orange-500/20 px-1 rounded text-[10px]">High</span> severity</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-violet-950 border border-violet-500/50 flex items-center justify-center shrink-0">
                    <Route className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="bg-[#111827] p-3 rounded-lg border border-white/5 w-full">
                    <span className="text-xs font-bold text-violet-400 block mb-1">Routing Agent</span>
                    <p className="text-sm text-slate-300">Assigned complaint to <span className="text-white font-semibold">Roads Department</span> queue</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-500/50 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="bg-[#111827] p-3 rounded-lg border border-white/5 w-full">
                    <span className="text-xs font-bold text-emerald-400 block mb-1">Notification Agent</span>
                    <p className="text-sm text-slate-300">Alerted field officer and notified citizen</p>
                  </div>
                </div>

             </div>
             
             <div className="mt-8 text-center animate-bounce">
               <ArrowDown className="w-5 h-5 text-cyan-500/50 mx-auto" />
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AgenticAICenter;
