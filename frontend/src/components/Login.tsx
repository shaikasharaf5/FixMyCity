import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../lib/apiClient';

type DemoRole = {
  id: 'central' | 'citizen' | 'officer';
  title: string;
  eyebrow: string;
  username: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  features: string[];
};

const demoRoles: DemoRole[] = [
  {
    id: 'central',
    title: 'Central Room',
    eyebrow: 'City command',
    username: 'admin',
    description: 'Review civic reports by district and assign the responsible officer.',
    icon: Radio,
    accent: 'violet',
    features: ['Command map', 'All departments'],
  },
  {
    id: 'citizen',
    title: 'Citizen 1',
    eyebrow: 'Public services',
    username: 'citizen1',
    description: 'Report civic issues, track progress and stay connected to your ward.',
    icon: UserRound,
    accent: 'cyan',
    features: ['Report an issue', 'Track requests'],
  },
  {
    id: 'officer',
    title: 'Officer',
    eyebrow: 'Field operations',
    username: 'officer1',
    description: 'Manage assigned cases, record evidence and complete field actions.',
    icon: ShieldCheck,
    accent: 'emerald',
    features: ['My assignments', 'Field evidence'],
  },
];

export const Login: React.FC<{ onSwitchToRegister: () => void }> = ({ onSwitchToRegister }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('citizen1');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  const authenticate = async (selectedUsername: string, selectedPassword: string, roleId = 'manual') => {
    setError('');
    setLoadingRole(roleId);
    try {
      const formData = new FormData();
      formData.append('username', selectedUsername);
      formData.append('password', selectedPassword);
      const response = await fetch(`${API_BASE}/auth/login`, { method: 'POST', body: formData });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || 'The credentials could not be verified.');
      }
      const data = await response.json();
      login(data.access_token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to CiviTrack services.');
    } finally {
      setLoadingRole(null);
    }
  };

  const useDemoRole = (role: DemoRole) => {
    setUsername(role.username);
    setPassword('password123');
    void authenticate(role.username, 'password123', role.id);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void authenticate(username, password);
  };

  return (
    <section className="role-gateway" aria-labelledby="gateway-title">
      <div className="role-gateway__glow role-gateway__glow--violet" />
      <div className="role-gateway__glow role-gateway__glow--cyan" />

      <motion.header
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="role-gateway__header"
      >
        <div className="role-gateway__seal"><Building2 /><span><i />Government service gateway</span></div>
        <div className="role-gateway__eyebrow"><Sparkles /> One city. Three purpose-built workspaces.</div>
        <h1 id="gateway-title">Enter the <span>CiviTrack</span> network</h1>
        <p>Select a demo identity to securely open its dedicated dashboard. Every role has different tools, data and actions.</p>
      </motion.header>

      <motion.div
        className="role-card-grid"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
      >
        {demoRoles.map((role) => {
          const Icon = role.icon;
          const isLoading = loadingRole === role.id;
          return (
            <motion.button
              key={role.id}
              type="button"
              className={`role-card role-card--${role.accent}`}
              onClick={() => useDemoRole(role)}
              disabled={loadingRole !== null}
              variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -7, scale: 1.012 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="role-card__shine" />
              <span className="role-card__top"><span className="role-card__icon"><Icon /></span><span className="role-card__live"><i /> Ready</span></span>
              <span className="role-card__eyebrow">{role.eyebrow}</span>
              <strong>{role.title}</strong>
              <span className="role-card__description">{role.description}</span>
              <span className="role-card__features">{role.features.map((feature) => <span key={feature}><CheckCircle2 />{feature}</span>)}</span>
              <span className="role-card__footer"><span><Fingerprint /> @{role.username}</span><span className="role-card__launch">{isLoading ? <i className="role-spinner" /> : <><span>Open dashboard</span><ArrowRight /></>}</span></span>
            </motion.button>
          );
        })}
      </motion.div>

      <motion.div
        className="manual-login"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
      >
        <div className="manual-login__heading"><div><LockKeyhole /><span><b>Secure sign in</b><small>Use another authorised account</small></span></div><span className="manual-login__secure"><i /> Encrypted session</span></div>
        <form onSubmit={handleSubmit}>
          <label><span>Username</span><div><UsersRound /><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></div></label>
          <label><span>Password</span><div><LockKeyhole /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
          <motion.button type="submit" className="manual-login__submit" disabled={loadingRole !== null} whileTap={{ scale: 0.96 }}>{loadingRole === 'manual' ? <i className="role-spinner" /> : <>Sign in <ArrowRight /></>}</motion.button>
        </form>
        {error && <div className="manual-login__error" role="alert">{error}</div>}
        <div className="manual-login__meta"><span>Demo password: <code>password123</code></span><button type="button" onClick={onSwitchToRegister}>Create citizen account</button></div>
      </motion.div>
    </section>
  );
};

export default Login;
