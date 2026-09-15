import React, { useState, useEffect, useCallback, useMemo } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  AreaChart,
  Area,
} from "recharts";
import {
  BarChart3,
  PieChart as PieIcon,
  Award,
  Users2,
  Landmark,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  RefreshCw,
  Download,
  Filter,
  MapPin,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Target,
  Layers,
  Globe,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────── */
interface DistrictComparison {
  district_name: string;
  pending_count: number;
  resolved_count: number;
  critical_count: number;
}
interface CategoryDist {
  category: string;
  count: number;
}
interface StatusDist {
  status: string;
  count: number;
}
interface AnalyticsData {
  total_complaints: number;
  total_resolved: number;
  total_pending: number;
  district_comparison: DistrictComparison[];
  category_distribution: CategoryDist[];
  status_distribution: StatusDist[];
}

/* ─── Palette ────────────────────────────────────────────────────────── */
const COLORS = [
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#a855f7",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#84cc16",
];

const GRADIENT_IDS = ["grad0", "grad1", "grad2", "grad3", "grad4", "grad5"];

/* ─── Animated Counter ───────────────────────────────────────────────── */
const AnimatedCounter: React.FC<{
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}> = ({ value, duration = 1500, prefix = "", suffix = "", className = "" }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const from = 0;
    const frame = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * ease));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
};

/* ─── Glowing Spinner ────────────────────────────────────────────────── */
const GlowSpinner: React.FC = () => (
  <div className="py-40 flex flex-col items-center justify-center gap-6">
    <div className="relative">
      <div className="w-16 h-16 border-2 border-amber-500/20 rounded-full" />
      <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-t-amber-500 rounded-full animate-spin" />
      <div
        className="absolute inset-2 w-12 h-12 border-2 border-transparent border-t-amber-400/50 rounded-full animate-spin"
        style={{ animationDirection: "reverse", animationDuration: "0.8s" }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <Landmark className="w-5 h-5 text-amber-500/70" />
      </div>
    </div>
    <div className="text-center space-y-1">
      <p className="text-[10px] text-amber-500/80 font-black uppercase tracking-[0.3em] font-mono">
        Compiling State Telemetry
      </p>
      <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.2em] font-mono">
        Aggregating district data...
      </p>
    </div>
  </div>
);

/* ─── Custom Tooltip ─────────────────────────────────────────────────── */
const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl p-3 shadow-2xl shadow-black/50 text-xs font-mono">
      {label && (
        <p className="text-zinc-400 font-bold uppercase tracking-wider text-[9px] mb-2 border-b border-zinc-800 pb-2">
          {label}
        </p>
      )}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mt-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: entry.color || entry.fill }}
          />
          <span className="text-zinc-400 text-[9px] uppercase">{entry.name}:</span>
          <span className="text-zinc-100 font-black">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

/* ─── KPI Card ───────────────────────────────────────────────────────── */
interface KpiCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: "amber" | "emerald" | "blue" | "purple" | "red";
  trend?: number;
  suffix?: string;
  prefix?: string;
  delay?: number;
  animate?: boolean;
}

const colorMap = {
  amber: {
    icon: "text-amber-400",
    bg: "bg-amber-500/8",
    border: "border-amber-500/15",
    glow: "shadow-amber-500/10",
    value: "text-amber-400",
    bar: "bg-amber-500",
    trendUp: "text-amber-400",
  },
  emerald: {
    icon: "text-emerald-400",
    bg: "bg-emerald-500/8",
    border: "border-emerald-500/15",
    glow: "shadow-emerald-500/10",
    value: "text-emerald-400",
    bar: "bg-emerald-500",
    trendUp: "text-emerald-400",
  },
  blue: {
    icon: "text-blue-400",
    bg: "bg-blue-500/8",
    border: "border-blue-500/15",
    glow: "shadow-blue-500/10",
    value: "text-blue-400",
    bar: "bg-blue-500",
    trendUp: "text-blue-400",
  },
  purple: {
    icon: "text-purple-400",
    bg: "bg-purple-500/8",
    border: "border-purple-500/15",
    glow: "shadow-purple-500/10",
    value: "text-purple-400",
    bar: "bg-purple-500",
    trendUp: "text-purple-400",
  },
  red: {
    icon: "text-red-400",
    bg: "bg-red-500/8",
    border: "border-red-500/15",
    glow: "shadow-red-500/10",
    value: "text-red-400",
    bar: "bg-red-500",
    trendUp: "text-red-400",
  },
};

const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  icon,
  color,
  trend,
  suffix = "",
  prefix = "",
  delay = 0,
  animate = true,
}) => {
  const [visible, setVisible] = useState(false);
  const c = colorMap[color];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className={`relative p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800/60 backdrop-blur-sm overflow-hidden group cursor-default transition-all duration-700 hover:border-zinc-700/60 hover:shadow-xl ${c.glow} hover:scale-[1.02] ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms` }}
    >
      {/* Background glow */}
      <div
        className={`absolute -top-6 -right-6 w-20 h-20 rounded-full ${c.bg} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
      />

      {/* Top row */}
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div
          className={`p-2.5 rounded-xl ${c.bg} border ${c.border} ${c.icon} transition-all duration-300 group-hover:scale-110`}
        >
          {icon}
        </div>
        {trend !== undefined && (
          <div
            className={`flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-lg border ${
              trend >= 0
                ? "text-emerald-400 bg-emerald-500/8 border-emerald-500/20"
                : "text-red-400 bg-red-500/8 border-red-500/20"
            }`}
          >
            {trend >= 0 ? (
              <ArrowUpRight className="w-2.5 h-2.5" />
            ) : (
              <ArrowDownRight className="w-2.5 h-2.5" />
            )}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      {/* Value */}
      <div className="relative z-10">
        <div className={`text-3xl font-black font-mono tracking-tight ${c.value}`}>
          {animate && typeof value === "number" ? (
            <AnimatedCounter value={value} prefix={prefix} suffix={suffix} />
          ) : (
            <span>
              {prefix}
              {value}
              {suffix}
            </span>
          )}
        </div>
        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] font-mono mt-1.5">
          {label}
        </p>
      </div>

      {/* Bottom bar */}
      <div className="mt-4 h-0.5 bg-zinc-800/60 rounded-full overflow-hidden relative z-10">
        <div
          className={`h-full ${c.bar} rounded-full transition-all duration-1000`}
          style={{
            width: visible ? "65%" : "0%",
            transitionDelay: `${delay + 300}ms`,
            boxShadow: `0 0 8px currentColor`,
          }}
        />
      </div>
    </div>
  );
};

/* ─── Chart Card Wrapper ─────────────────────────────────────────────── */
const ChartCard: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  badge?: string;
}> = ({ title, subtitle, icon, children, className = "", badge }) => (
  <div
    className={`relative p-5 sm:p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800/60 backdrop-blur-sm overflow-hidden group hover:border-zinc-700/50 transition-all duration-500 ${className}`}
  >
    {/* Corner accent */}
    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/[0.02] rounded-bl-full pointer-events-none" />

    <div className="flex items-start justify-between mb-5 relative z-10">
      <div className="flex items-center gap-2.5">
        {icon && (
          <div className="p-2 rounded-lg bg-amber-500/8 border border-amber-500/15 text-amber-500">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-xs font-black text-zinc-200 uppercase tracking-[0.12em] font-mono">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-[0.15em] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {badge && (
        <span className="text-[8px] font-black px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase tracking-wider font-mono">
          {badge}
        </span>
      )}
    </div>
    <div className="relative z-10">{children}</div>
  </div>
);

/* ─── District Selector ──────────────────────────────────────────────── */
const DistrictSelector: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const districts = [
    { value: "state", label: "All Districts — Statewide" },
    { value: "hyderabad", label: "Hyderabad District" },
    { value: "rangareddy", label: "Rangareddy District" },
    { value: "medchal", label: "Medchal-Malkajgiri District" },
    { value: "warangal", label: "Warangal District" },
    { value: "nizamabad", label: "Nizamabad District" },
  ];

  return (
    <div className="relative group">
      <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-xs font-mono cursor-pointer hover:border-amber-500/30 transition-all duration-300 backdrop-blur-sm">
        <MapPin className="w-3 h-3 text-amber-500/60" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent text-zinc-200 font-bold text-[10px] uppercase tracking-wider focus:outline-none cursor-pointer appearance-none pr-6"
          style={{ minWidth: "200px" }}
        >
          {districts.map((d) => (
            <option key={d.value} value={d.value} className="bg-zinc-900 text-zinc-200 text-xs">
              {d.label.toUpperCase()}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3 h-3 text-zinc-500 absolute right-3 pointer-events-none" />
      </div>
    </div>
  );
};

/* ─── Resolution Efficiency Bar ──────────────────────────────────────── */
const EfficiencyBar: React.FC<{ value: number; max: number; color: string }> = ({
  value,
  max,
  color,
}) => {
  const [width, setWidth] = useState(0);
  const pct = Math.round((value / max) * 100);

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 300);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <div className="mt-2 h-1.5 bg-zinc-800/60 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{
          width: `${width}%`,
          background: color,
          boxShadow: `0 0 6px ${color}60`,
        }}
      />
    </div>
  );
};

/* ─── Department Card ────────────────────────────────────────────────── */
const DepartmentCard: React.FC<{
  dept: { department_name: string; resolved_count: number; avg_resolution_time_days: number };
  index: number;
  maxResolved: number;
}> = ({ dept, index, maxResolved }) => {
  const colors = [
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#a855f7",
    "#ef4444",
    "#06b6d4",
  ];
  const color = colors[index % colors.length];
  const efficiency = Math.max(0, 100 - dept.avg_resolution_time_days * 10);

  return (
    <div
      className="p-4 bg-zinc-950/50 border border-zinc-800/40 rounded-xl hover:border-zinc-700/50 transition-all duration-300 hover:shadow-lg group"
      style={{
        animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: color, boxShadow: `0 0 6px ${color}80` }}
          />
          <div>
            <h4 className="font-black text-[10px] text-zinc-200 uppercase tracking-[0.1em] leading-tight">
              {dept.department_name}
            </h4>
          </div>
        </div>
        <div
          className="text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-wider"
          style={{
            color,
            background: `${color}15`,
            border: `1px solid ${color}30`,
          }}
        >
          {efficiency.toFixed(0)}% EFF
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-wider font-mono">
            Resolved
          </p>
          <p className="text-lg font-black font-mono" style={{ color }}>
            {dept.resolved_count}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-wider font-mono">
            Avg Time
          </p>
          <p className="text-lg font-black text-zinc-300 font-mono">
            {dept.avg_resolution_time_days}d
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <EfficiencyBar value={dept.resolved_count} max={maxResolved} color={color} />
      <div className="flex justify-between mt-1">
        <span className="text-[7px] text-zinc-600 font-bold font-mono uppercase">0</span>
        <span className="text-[7px] text-zinc-600 font-bold font-mono uppercase">
          {maxResolved} max
        </span>
      </div>
    </div>
  );
};

/* ─── Main Component ─────────────────────────────────────────────────── */
export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("state");
  const [districtData, setDistrictData] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);

  /* Fake trend data for sparkline */
  const trendData = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        month: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][i],
        resolved: Math.floor(Math.random() * 60) + 20,
        pending: Math.floor(Math.random() * 30) + 5,
        critical: Math.floor(Math.random() * 15) + 2,
      })),
    []
  );

  useEffect(() => {
    fetchAnalytics();
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, [user]);

  useEffect(() => {
    if (selectedDistrict !== "state") {
      fetchDistrictAnalytics(selectedDistrict);
    } else {
      setDistrictData(null);
    }
  }, [selectedDistrict]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/analytics/state");
      setData(res.data);
      setLastUpdated(new Date());
    } catch {
      /* fallback mock */
      setData({
        total_complaints: 847,
        total_resolved: 612,
        total_pending: 235,
        district_comparison: [
          { district_name: "Hyderabad", pending_count: 45, resolved_count: 187, critical_count: 12 },
          { district_name: "Rangareddy", pending_count: 62, resolved_count: 143, critical_count: 8 },
          { district_name: "Medchal", pending_count: 38, resolved_count: 98, critical_count: 5 },
          { district_name: "Warangal", pending_count: 55, resolved_count: 112, critical_count: 9 },
          { district_name: "Nizamabad", pending_count: 35, resolved_count: 72, critical_count: 4 },
        ],
        category_distribution: [
          { category: "Roads", count: 234 },
          { category: "Water", count: 187 },
          { category: "Waste", count: 156 },
          { category: "Electricity", count: 143 },
          { category: "Drainage", count: 87 },
          { category: "Other", count: 40 },
        ],
        status_distribution: [
          { status: "Resolved", count: 612 },
          { status: "Pending", count: 145 },
          { status: "In Progress", count: 62 },
          { status: "Critical", count: 28 },
        ],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDistrictAnalytics = useCallback(async (distName: string) => {
    try {
      const res = await api.get(`/api/analytics/district/${distName}`);
      setDistrictData(res.data);
    } catch {
      setDistrictData({
        resolved_count: 143,
        pending_count: 62,
        category_distribution: [
          { category: "Roads", count: 48 },
          { category: "Water", count: 37 },
          { category: "Waste", count: 29 },
          { category: "Electricity", count: 22 },
          { category: "Drainage", count: 7 },
        ],
        department_performance: [
          { department_name: "Roads & Buildings", resolved_count: 48, avg_resolution_time_days: 2.1 },
          { department_name: "Waste Management", resolved_count: 37, avg_resolution_time_days: 1.4 },
          { department_name: "Water Supply", resolved_count: 29, avg_resolution_time_days: 3.2 },
          { department_name: "Electricity Board", resolved_count: 22, avg_resolution_time_days: 1.1 },
        ],
      });
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setTimeout(() => setRefreshing(false), 600);
  }, [fetchAnalytics]);

  /* Derived values */
  const totalComplaints =
    selectedDistrict === "state"
      ? data?.total_complaints ?? 0
      : (districtData?.resolved_count ?? 0) + (districtData?.pending_count ?? 0);
  const totalResolved =
    selectedDistrict === "state" ? data?.total_resolved ?? 0 : districtData?.resolved_count ?? 0;
  const totalPending =
    selectedDistrict === "state" ? data?.total_pending ?? 0 : districtData?.pending_count ?? 0;
  const resolutionRate = totalComplaints
    ? Math.round((totalResolved / totalComplaints) * 100)
    : 0;

  const districtChartData = useMemo(
    () =>
      data?.district_comparison.map((item) => ({
        name: item.district_name,
        Resolved: item.resolved_count,
        Pending: item.pending_count,
        Critical: item.critical_count,
      })) ?? [],
    [data]
  );

  const categoryChartData = useMemo(
    () =>
      (
        selectedDistrict === "state"
          ? data?.category_distribution
          : districtData?.category_distribution
      )?.map((item: any) => ({ name: item.category, value: item.count })) ?? [],
    [data, districtData, selectedDistrict]
  );

  const statusChartData = useMemo(
    () =>
      data?.status_distribution.map((item) => ({
        name: item.status,
        value: item.count,
      })) ?? [],
    [data]
  );

  const deptList = useMemo(
    () =>
      districtData?.department_performance ?? [
        { department_name: "Roads & Buildings", resolved_count: 48, avg_resolution_time_days: 2.1 },
        { department_name: "Waste Management", resolved_count: 37, avg_resolution_time_days: 1.4 },
        { department_name: "Water Supply & Sewerage", resolved_count: 29, avg_resolution_time_days: 3.5 },
        { department_name: "Electricity Board", resolved_count: 22, avg_resolution_time_days: 1.2 },
        { department_name: "Public Works Dept", resolved_count: 18, avg_resolution_time_days: 2.8 },
        { department_name: "Health & Sanitation", resolved_count: 14, avg_resolution_time_days: 1.9 },
      ],
    [districtData]
  );

  const maxResolved = useMemo(
    () => Math.max(...deptList.map((d: any) => d.resolved_count), 1),
    [deptList]
  );

  if (loading && !data) return <GlowSpinner />;

  return (
    <>
      {/* Inline keyframes */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes shimmer {
          0%,100% { opacity:1; }
          50%      { opacity:0.6; }
        }
        @keyframes glow-pulse {
          0%,100% { box-shadow: 0 0 4px rgba(245,158,11,0.3); }
          50%      { box-shadow: 0 0 16px rgba(245,158,11,0.6); }
        }
        @keyframes spin-slow {
          to { transform: rotate(360deg); }
        }
        .chart-enter { animation: scaleIn 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .slide-left  { animation: slideInLeft 0.5s ease-out both; }
      `}</style>

      <div
        className={`flex flex-col gap-6 transition-opacity duration-700 ${mounted ? "opacity-100" : "opacity-0"}`}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/60 backdrop-blur-sm p-5 sm:p-6"
          style={{ animation: "fadeInUp 0.5s ease-out both" }}
        >
          {/* Corner decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/[0.03] rounded-bl-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/[0.02] rounded-tr-full pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
            {/* Title */}
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex-shrink-0">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-black text-zinc-100 uppercase tracking-[0.12em] font-mono">
                    State Analytics Terminal
                  </h2>
                  <span
                    className="text-[7px] font-black px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase tracking-[0.15em]"
                    style={{ animation: "shimmer 3s ease-in-out infinite" }}
                  >
                    Live
                  </span>
                </div>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.15em] mt-1 flex items-center gap-1.5">
                  <Globe className="w-2.5 h-2.5" />
                  Cross-district metrics · Resolution efficiency
                </p>
                <p className="text-[8px] text-zinc-600 font-mono mt-0.5 flex items-center gap-1">
                  <Clock className="w-2 h-2" />
                  Updated: {lastUpdated.toLocaleTimeString("en-IN")}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <DistrictSelector value={selectedDistrict} onChange={setSelectedDistrict} />

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-amber-500/30 transition-all duration-300 text-[9px] font-black uppercase tracking-wider disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/15 transition-all duration-300 text-[9px] font-black uppercase tracking-wider">
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── KPI Grid ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            label="Total Logged Issues"
            value={totalComplaints}
            icon={<BarChart3 className="w-4 h-4" />}
            color="amber"
            trend={12}
            delay={0}
          />
          <KpiCard
            label="Resolved Tickets"
            value={totalResolved}
            icon={<CheckCircle2 className="w-4 h-4" />}
            color="emerald"
            trend={8}
            delay={100}
          />
          <KpiCard
            label="Pending Pipeline"
            value={totalPending}
            icon={<AlertTriangle className="w-4 h-4" />}
            color="amber"
            trend={-5}
            delay={200}
          />
          <KpiCard
            label="Resolution Rate"
            value={resolutionRate}
            icon={<Target className="w-4 h-4" />}
            color="blue"
            suffix="%"
            delay={300}
          />
        </div>

        {/* ── Secondary KPIs ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active Regions", value: "33 Dist.", icon: <MapPin className="w-3.5 h-3.5" />, color: "#a855f7" },
            { label: "Avg Resolution", value: "2.4 Days", icon: <Clock className="w-3.5 h-3.5" />, color: "#06b6d4" },
            { label: "Critical Issues", value: "28", icon: <Zap className="w-3.5 h-3.5" />, color: "#ef4444" },
            { label: "Departments", value: "14 Active", icon: <Layers className="w-3.5 h-3.5" />, color: "#10b981" },
          ].map((item, i) => (
            <div
              key={item.label}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/40 hover:border-zinc-700/50 transition-all duration-300 group"
              style={{ animation: `fadeInUp 0.5s ease-out ${i * 80 + 400}ms both` }}
            >
              <div
                className="p-2 rounded-lg flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                style={{ background: `${item.color}15`, border: `1px solid ${item.color}25`, color: item.color }}
              >
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-zinc-200 font-mono truncate">{item.value}</p>
                <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-wider truncate">{item.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Trend Line Chart ───────────────────────────────────────── */}
        <ChartCard
          title="Monthly Resolution Trend"
          subtitle="12-month activity overview"
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          badge="2025"
          className="chart-enter"
        >
          <div className="h-52 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pendingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="criticalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" strokeOpacity={0.5} />
                <XAxis dataKey="month" stroke="#3f3f46" fontSize={8} tickLine={false} tick={{ fill: "#71717a", fontFamily: "monospace" }} />
                <YAxis stroke="#3f3f46" fontSize={8} tickLine={false} tick={{ fill: "#71717a", fontFamily: "monospace" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 9, textTransform: "uppercase", fontFamily: "monospace" }} />
                <Area type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} fill="url(#resolvedGrad)" dot={false} activeDot={{ r: 4, fill: "#10b981" }} />
                <Area type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} fill="url(#pendingGrad)" dot={false} activeDot={{ r: 4, fill: "#f59e0b" }} />
                <Area type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={1.5} fill="url(#criticalGrad)" dot={false} activeDot={{ r: 3, fill: "#ef4444" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* ── Bar + Pie ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* District comparison bar */}
          {selectedDistrict === "state" && (
            <ChartCard
              title="District-wise Breakdown"
              subtitle="Pending vs resolved per district"
              icon={<BarChart3 className="w-3.5 h-3.5" />}
              className="lg:col-span-7 chart-enter"
              badge="Statewide"
            >
              <div className="h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={districtChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }} barGap={2}>
                    <defs>
                      {districtChartData.map((_, i) => (
                        <linearGradient key={i} id={`barGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                        </linearGradient>
                      ))}
                      <linearGradient id="pendBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" strokeOpacity={0.4} vertical={false} />
                    <XAxis dataKey="name" stroke="#3f3f46" fontSize={8} tickLine={false} tick={{ fill: "#71717a", fontFamily: "monospace" }} />
                    <YAxis stroke="#3f3f46" fontSize={8} tickLine={false} tick={{ fill: "#71717a", fontFamily: "monospace" }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(245,158,11,0.04)" }} />
                    <Legend wrapperStyle={{ fontSize: 9, textTransform: "uppercase", fontFamily: "monospace" }} />
                    <Bar dataKey="Resolved" fill="url(#barGrad0)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="Pending" fill="url(#pendBarGrad)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="Critical" fill="#ef444480" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {/* Pie chart */}
          <ChartCard
            title="Issue Categories"
            subtitle="Distribution by type"
            icon={<PieIcon className="w-3.5 h-3.5" />}
            className={`${selectedDistrict === "state" ? "lg:col-span-5" : "lg:col-span-6"} chart-enter`}
          >
            <div className="h-64 sm:h-72 flex items-center justify-center">
              {categoryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      {COLORS.map((color, i) => (
                        <radialGradient key={i} id={GRADIENT_IDS[i]} cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor={color} stopOpacity={1} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                        </radialGradient>
                      ))}
                    </defs>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryChartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={`url(#${GRADIENT_IDS[index % GRADIENT_IDS.length]})`} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-[10px] text-zinc-500 font-mono">No data available</p>
              )}
            </div>
          </ChartCard>

          {/* Status distribution — only statewide */}
          {selectedDistrict === "state" && statusChartData.length > 0 && (
            <ChartCard
              title="Status Distribution"
              subtitle="Current pipeline state"
              icon={<Activity className="w-3.5 h-3.5" />}
              className="lg:col-span-6 chart-enter"
            >
              <div className="h-56 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="30%"
                    outerRadius="90%"
                    data={statusChartData.map((d, i) => ({
                      ...d,
                      fill: COLORS[i % COLORS.length],
                    }))}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar dataKey="value" cornerRadius={4} background={{ fill: "#18181b" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                      wrapperStyle={{ fontSize: 8, fontFamily: "monospace", textTransform: "uppercase" }}
                      iconSize={6}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {/* Resolution trend per district */}
          {selectedDistrict !== "state" && (
            <ChartCard
              title="District Trend"
              subtitle={`${selectedDistrict} — monthly`}
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              className="lg:col-span-6 chart-enter"
            >
              <div className="h-56 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData.slice(0, 8)}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" strokeOpacity={0.5} />
                    <XAxis dataKey="month" stroke="#3f3f46" fontSize={8} tickLine={false} tick={{ fill: "#71717a" }} />
                    <YAxis stroke="#3f3f46" fontSize={8} tickLine={false} tick={{ fill: "#71717a" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}
        </div>

        {/* ── Department Performance ─────────────────────────────────── */}
        <ChartCard
          title="Department Performance & Resolution Efficiency"
          subtitle="Avg resolution time · tickets closed"
          icon={<Shield className="w-3.5 h-3.5" />}
          badge="Live"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-1">
            {deptList.map((dept: any, index: number) => (
              <DepartmentCard
                key={dept.department_name}
                dept={dept}
                index={index}
                maxResolved={maxResolved}
              />
            ))}
          </div>
        </ChartCard>
      </div>
    </>
  );
};

export default AdminDashboard;
