import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { User, ShieldAlert, Shield, Sparkles, Building2, Eye, EyeOff } from "lucide-react";
import { api } from "../lib/apiClient";

export const AuthPortal: React.FC = () => {
  const { login } = useAuth();

  // Portal tabs
  const [portalType, setPortalType] = useState<"citizen" | "gov">("citizen");
  // Form mode
  const [citizenMode, setCitizenMode] = useState<"login" | "register">("login");

  // Form fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [district, setDistrict] = useState("Hyderabad");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const districts = [
    "Adilabad","Bhadradri Kothagudem","Hanamkonda","Hyderabad","Jagtial","Jangaon",
    "Jayashankar Bhupally","Jogulamba Gadwal","Kamareddy","Karimnagar","Khammam",
    "Kumuram Bheem Asifabad","Mahabubabad","Mahabubnagar","Mancherial","Medak",
    "Medchal-Malkajgiri","Mulugu","Nagarkurnool","Nalgonda","Narayanpet","Nirmal",
    "Nizamabad","Peddapalli","Rajanna Sircilla","Rangareddy","Sangareddy","Siddipet",
    "Suryapet","Vikarabad","Wanaparthy","Warangal","Yadadri Bhuvanagiri",
  ];

  const doLogin = async (u: string, p: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("username", u);
      params.append("password", p);

      const res = await fetch("http://127.0.0.1:8001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Login failed");
      }
      const data = await res.json();
      login(data.access_token, data.user);
      setSuccess(`Welcome, @${data.user.username}!`);
    } catch (err: any) {
      setError(err.message || "Could not sign in. Check credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError("Username and password are required.");
      return;
    }

    if (portalType === "citizen" && citizenMode === "register") {
      if (!email || !phoneNumber) {
        setError("Email and phone number are required for registration.");
        return;
      }
      setSubmitting(true);
      try {
        await fetch("http://127.0.0.1:8001/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username, email, password, role: "citizen",
            phone_number: phoneNumber, district,
          }),
        }).then(async r => { if (!r.ok) throw new Error((await r.json()).detail); });
        await doLogin(username, password);
      } catch (err: any) {
        setError(err.message || "Registration failed.");
        setSubmitting(false);
      }
      return;
    }

    await doLogin(username, password);
  };

  const quickLogin = async (u: string) => {
    await doLogin(u, "password123");
  };

  const switchPortal = (type: "citizen" | "gov") => {
    setPortalType(type);
    setUsername(""); setPassword(""); setEmail(""); setError(null); setSuccess(null);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-6 px-4">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-slate-200/80 p-8 flex flex-col gap-6">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-slate-50 border border-slate-200 mb-3.5 shadow-sm">
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight uppercase">CiviTrack Portal</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
            District Infrastructure &amp; Reporting Dashboard
          </p>
        </div>

        {/* Portal Switcher */}
        <div className="grid grid-cols-2 gap-1 bg-slate-50 border border-slate-200 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => switchPortal("citizen")}
            className={`flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider text-[10px] h-9 rounded-xl transition-all ${
              portalType === "citizen"
                ? "bg-[#18181b] text-white shadow"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <User className="w-3.5 h-3.5" /> Resident Portal
          </button>
          <button
            type="button"
            onClick={() => switchPortal("gov")}
            className={`flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider text-[10px] h-9 rounded-xl transition-all ${
              portalType === "gov"
                ? "bg-[#18181b] text-white shadow"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Officer Console
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              {portalType === "citizen" ? "Resident Login" : "Officer / Admin Sign In"}
            </span>
            {portalType === "citizen" && (
              <button
                type="button"
                onClick={() => setCitizenMode(citizenMode === "login" ? "register" : "login")}
                className="text-[9.5px] text-indigo-600 hover:text-indigo-800 font-bold uppercase tracking-wider"
              >
                {citizenMode === "login" ? "Register Account" : "Sign In?"}
              </button>
            )}
          </div>

          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-400"
              required
            />
          </div>

          {/* Email (register only) */}
          {portalType === "citizen" && citizenMode === "register" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-400"
                required
              />
            </div>
          )}

          {/* Phone (register only) */}
          {portalType === "citizen" && citizenMode === "register" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">WhatsApp Phone Number</label>
              <input
                type="text"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="e.g. 919988776655"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-400"
                required
              />
            </div>
          )}

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-9 text-sm text-slate-800 focus:outline-none focus:border-indigo-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* District (register only) */}
          {portalType === "citizen" && citizenMode === "register" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">District</label>
              <select
                value={district}
                onChange={e => setDistrict(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-400"
              >
                {districts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-slate-900 hover:bg-black text-white font-bold uppercase tracking-wider py-2.5 rounded-xl mt-1 transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : citizenMode === "register" && portalType === "citizen" ? "Create Account" : "Sign In"}
          </button>
        </form>

        {/* ── Quick Login ─────────────────────────────────────────────────── */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
          <div className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            One-Click Demo Login
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Citizen */}
            <button
              id="quick-login-citizen"
              onClick={() => quickLogin("citizen_demo")}
              disabled={submitting}
              className="p-3 h-auto text-left rounded-2xl bg-slate-50/80 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition flex flex-col items-start gap-0.5 disabled:opacity-50"
            >
              <div className="flex items-center gap-1 mb-0.5">
                <User className="w-3 h-3 text-slate-500" />
                <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider">Citizen</span>
              </div>
              <span className="text-[9.5px] font-semibold text-slate-800">@citizen_demo</span>
            </button>

            {/* Officer */}
            <button
              id="quick-login-officer"
              onClick={() => quickLogin("officer")}
              disabled={submitting}
              className="p-3 h-auto text-left rounded-2xl bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200 hover:border-blue-300 transition flex flex-col items-start gap-0.5 disabled:opacity-50"
            >
              <div className="flex items-center gap-1 mb-0.5">
                <Shield className="w-3 h-3 text-blue-500" />
                <span className="text-[7.5px] font-bold text-blue-600 uppercase tracking-wider">Officer</span>
              </div>
              <span className="text-[9.5px] font-semibold text-slate-800">@officer</span>
            </button>

            {/* Admin */}
            <button
              id="quick-login-admin"
              onClick={() => quickLogin("admin")}
              disabled={submitting}
              className="p-3 h-auto text-left rounded-2xl bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200 hover:border-emerald-300 transition flex flex-col items-start gap-0.5 disabled:opacity-50"
            >
              <div className="flex items-center gap-1 mb-0.5">
                <ShieldAlert className="w-3 h-3 text-emerald-600" />
                <span className="text-[7.5px] font-bold text-emerald-700 uppercase tracking-wider">Admin</span>
              </div>
              <span className="text-[9.5px] font-semibold text-slate-800">@admin</span>
            </button>
          </div>

          <p className="text-[8.5px] text-slate-400 text-center">All demo accounts use password: <span className="font-mono font-bold text-slate-600">password123</span></p>
        </div>

      </div>
    </div>
  );
};

export default AuthPortal;
