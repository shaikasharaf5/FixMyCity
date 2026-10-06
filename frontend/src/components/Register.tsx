import React, { useState } from 'react';
import { Shield, Mail, Lock, User, Phone, CheckCircle } from 'lucide-react';
import { api } from '../lib/apiClient';

export const Register: React.FC<{ onSwitchToLogin: () => void }> = ({ onSwitchToLogin }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'citizen' | 'officer'>('citizen');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const payload = {
        username,
        email,
        password,
        phone_number: phone || undefined,
        role
      };
      
      await fetch('http://127.0.0.1:8001/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(async res => {
        if (!res.ok) {
           const err = await res.json();
           throw new Error(err.detail || "Registration failed");
        }
      });
      
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 w-full page-transition-enter-active">
              <div className="glass-panel p-8 max-w-md w-full border-t-2 border-t-emerald-500 text-center">
                  <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-white mb-2">Registration Successful</h2>
                  <p className="text-slate-400 mb-6">Your account has been created successfully.</p>
                  <button onClick={onSwitchToLogin} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg transition-colors">
                      Proceed to Login
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 w-full page-transition-enter-active">
      <div className="glass-panel p-8 max-w-md w-full border-t-2 border-t-violet-500 shadow-[0_0_30px_rgba(139,92,246,0.15)] relative overflow-hidden">
        
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <h2 className="text-2xl font-bold text-center text-white mb-2 relative z-10">Create Account</h2>
        <p className="text-center text-slate-400 text-sm mb-6 relative z-10">Join the FixMyCity AI network</p>

        {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm text-center font-semibold">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative z-10">
          
          <div className="flex bg-[#111827] p-1 rounded-lg border border-white/10 mb-2">
             <button type="button" onClick={() => setRole('citizen')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${role === 'citizen' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>Citizen</button>
             <button type="button" onClick={() => setRole('officer')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${role === 'officer' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>Officer</button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User className="h-4 w-4 text-slate-500" /></div>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition" required />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail className="h-4 w-4 text-slate-500" /></div>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition" required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number (Optional)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Phone className="h-4 w-4 text-slate-500" /></div>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition" />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-4 w-4 text-slate-500" /></div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition" required minLength={6} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full mt-4 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold py-2.5 rounded-lg shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50">
            {loading ? "Creating Account..." : "Register"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400 relative z-10">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="text-violet-400 hover:text-violet-300 font-bold">
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
