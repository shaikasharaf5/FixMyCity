import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  Bot,
  Building2,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import LandingPage from './components/LandingPage';
import CitizenPortal from './components/CitizenPortal';
import LiveCityMap from './components/LiveCityMap';
import GovDashboard from './components/GovDashboard';
import OfficerDashboard from './components/OfficerDashboard';
import AnalyticsInsights from './components/AnalyticsInsights';
import AgenticAICenter from './components/AgenticAICenter';
import CommunityBoard from './components/CommunityBoard';
import Login from './components/Login';
import Register from './components/Register';
import WhatsAppSimulator from './components/WhatsAppSimulator';
import ChatBot from './components/ChatBot';
import { useAuth } from './contexts/AuthContext';

type NavItem = { id: string; label: string; description: string; icon: React.ElementType };

export const App: React.FC = () => {
  const { user, logout, isLoading, isOfficerOrAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('landing');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isWASimulatorOpen, setIsWASimulatorOpen] = useState(false);

  const isCentralRoom = Boolean(user && ['admin', 'district_admin', 'state_admin'].includes(user.role));
  const isFieldOfficer = Boolean(user && ['officer', 'reviewer'].includes(user.role));

  useEffect(() => {
    if (!user && !['landing', 'login', 'register'].includes(activeTab)) setActiveTab('landing');
    if (user?.role === 'citizen' && !['citizen', 'map', 'community'].includes(activeTab)) setActiveTab('citizen');
    if (isCentralRoom && !['gov', 'analytics', 'agents', 'map', 'community'].includes(activeTab)) setActiveTab('gov');
    if (isFieldOfficer && !['officer', 'map', 'community'].includes(activeTab)) setActiveTab('officer');
  }, [activeTab, isCentralRoom, isFieldOfficer, user]);

  const navigate = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderContent = () => {
    if (!user) {
      if (activeTab === 'login') return <Login onSwitchToRegister={() => navigate('register')} />;
      if (activeTab === 'register') return <Register onSwitchToLogin={() => navigate('login')} />;
      return <LandingPage onNavigate={navigate} />;
    }
    if (user.role === 'citizen') {
      if (activeTab === 'map') return <LiveCityMap />;
      if (activeTab === 'community') return <CommunityBoard />;
      return <CitizenPortal onNavigate={navigate} onOpenSimulator={() => setIsWASimulatorOpen(true)} />;
    }
    if (isFieldOfficer) {
      if (activeTab === 'map') return <LiveCityMap />;
      if (activeTab === 'community') return <CommunityBoard />;
      return <OfficerDashboard />;
    }
    if (activeTab === 'analytics') return <AnalyticsInsights onNavigate={navigate} />;
    if (activeTab === 'agents') return <AgenticAICenter />;
    if (activeTab === 'map') return <LiveCityMap />;
    if (activeTab === 'community') return <CommunityBoard />;
    return <GovDashboard />;
  };

  const publicNav: NavItem[] = [
    { id: 'landing', label: 'Home', description: 'Public services', icon: Building2 },
    { id: 'login', label: 'Role access', description: 'Secure sign in', icon: ShieldCheck },
  ];
  const citizenNav: NavItem[] = [
    { id: 'citizen', label: 'My services', description: 'Report and track', icon: LayoutDashboard },
    { id: 'map', label: 'Track reports', description: 'Ward activity', icon: Map },
    { id: 'community', label: 'Community', description: 'Local notices', icon: Users },
  ];
  const centralNav: NavItem[] = [
    { id: 'gov', label: 'Command overview', description: 'City operations', icon: LayoutDashboard },
    { id: 'map', label: 'Live city map', description: 'Spatial incidents', icon: Map },
    { id: 'analytics', label: 'Performance', description: 'Reports and trends', icon: Bot },
    { id: 'agents', label: 'AI coordination', description: 'Automation desk', icon: Sparkles },
    { id: 'community', label: 'Public signals', description: 'Citizen updates', icon: Users },
  ];
  const officerNav: NavItem[] = [
    { id: 'officer', label: 'My field desk', description: 'Assigned work', icon: Route },
    { id: 'map', label: 'Area map', description: 'Routes and reports', icon: Map },
    { id: 'community', label: 'Community', description: 'Citizen signals', icon: Users },
  ];

  const currentNav = !user ? publicNav : isCentralRoom ? centralNav : isFieldOfficer ? officerNav : citizenNav;
  const currentItem = currentNav.find((item) => item.id === activeTab) || currentNav[0];
  const workspaceLabel = isCentralRoom ? 'Central Control Room' : isFieldOfficer ? 'Field Operations' : 'Citizen Services';

  if (isLoading) return <div className="min-h-screen bg-[#07110f]" />;

  if (!user) {
    return (
      <div className="government-app public-app min-h-screen">
        <div className="gov-utility-bar"><div className="gov-shell"><span>Government of Telangana</span><span className="hidden sm:inline">Urban civic services portal</span><span className="ml-auto hidden md:inline">A digital service of municipal administration</span></div></div>
        <header className="gov-header"><div className="gov-shell gov-header__content">
          <button className="gov-brand" onClick={() => navigate('landing')} aria-label="Go to home"><span className="gov-brand__mark"><Building2 className="h-5 w-5" /></span><span><b>FixMyCity</b><small>Municipal citizen services</small></span></button>
          <nav className="gov-nav hidden lg:flex" aria-label="Main navigation">{publicNav.map((item) => <button key={item.id} onClick={() => navigate(item.id)} className={activeTab === item.id ? 'is-active' : ''}><item.icon className="h-4 w-4" />{item.label}</button>)}</nav>
          <div className="gov-header__actions"><button className="gov-help hidden sm:inline-flex"><CircleHelp className="h-4 w-4" />Help</button><button className="gov-sign-in" onClick={() => navigate('login')}>Sign in</button><button className="gov-mobile-toggle lg:hidden" onClick={() => setIsMobileMenuOpen((open) => !open)} aria-label="Toggle navigation">{isMobileMenuOpen ? <X /> : <Menu />}</button></div>
        </div>{isMobileMenuOpen && <div className="gov-mobile-menu"><div className="gov-shell">{publicNav.map((item) => <button key={item.id} onClick={() => navigate(item.id)} className={activeTab === item.id ? 'is-active' : ''}><item.icon className="h-4 w-4" />{item.label}</button>)}</div></div>}</header>
        <main className="gov-main"><div className="gov-shell gov-main__content">{renderContent()}</div></main>
        <footer className="gov-footer"><div className="gov-shell gov-footer__content"><div className="gov-footer__identity"><Building2 className="h-5 w-5" /><span><b>FixMyCity</b><small>Official municipal citizen-service platform</small></span></div><div className="gov-footer__links"><span>Privacy</span><span>Accessibility</span><span>Service status</span></div><span className="gov-footer__copyright">© 2026 Municipal Civic Services</span></div></footer>
      </div>
    );
  }

  return (
    <div className={`portal-shell workspace-${isCentralRoom ? 'central' : isFieldOfficer ? 'officer' : 'citizen'} ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
      {isMobileMenuOpen && <button className="portal-sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu" />}
      <aside className={`portal-sidebar ${isMobileMenuOpen ? 'is-mobile-open' : ''}`}>
        <div className="portal-sidebar__brand">
          <button onClick={() => navigate(currentNav[0].id)} aria-label="Open dashboard"><span><Building2 /></span><div><b>FixMyCity</b><small>Municipal citizen services</small></div></button>
          <button className="portal-sidebar__collapse" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}>{sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button>
          <button className="portal-sidebar__mobile-close" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close navigation"><X /></button>
        </div>

        <div className="portal-sidebar__workspace"><span>{isCentralRoom ? <Building2 /> : isFieldOfficer ? <ShieldCheck /> : <Users />}</span><div><small>Active workspace</small><b>{workspaceLabel}</b></div></div>

        <nav className="portal-sidebar__nav" aria-label={`${workspaceLabel} navigation`}>
          <small>Workspace</small>
          {currentNav.map((item) => <button key={item.id} onClick={() => navigate(item.id)} className={activeTab === item.id ? 'is-active' : ''} title={sidebarCollapsed ? item.label : undefined}><span className="portal-nav-icon"><item.icon /></span><span className="portal-nav-copy"><b>{item.label}</b><small>{item.description}</small></span>{activeTab === item.id && <i />}<ChevronRight className="portal-nav-chevron" /></button>)}
        </nav>

        <div className="portal-sidebar__account"><span>{user.username.slice(0, 1).toUpperCase()}</span><div><b>{user.username}</b><small>{isCentralRoom ? 'Command administrator' : isFieldOfficer ? 'Municipal field officer' : 'Verified citizen'}</small></div><button onClick={logout} aria-label="Sign out"><LogOut /></button></div>
      </aside>

      <div className="portal-stage">
        <header className="portal-topbar">
          <div className="portal-topbar__left"><button className="portal-mobile-menu" onClick={() => setIsMobileMenuOpen(true)} aria-label="Open navigation"><Menu /></button><div><span>{workspaceLabel}<ChevronRight />{currentItem.label}</span><h1>{currentItem.label}</h1></div></div>
          <div className="portal-topbar__actions"><span className="workspace-date"><CalendarDays />{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span><details className="workspace-help"><summary aria-label="Workspace guide"><CircleHelp /></summary><div><b>Your workspace guide</b><p>{isCentralRoom ? 'Filter by district, select a report from the map or register, then assign the responsible officer.' : isFieldOfficer ? 'Open an assigned complaint, review the location, and submit your work notes. Add an after-work photo to resolve it.' : 'Add a photo and allow location access. Review the detected issue, optionally generate a description, then submit your report.'}</p></div></details><span className="topbar-avatar" title={user.username}>{user.username.slice(0, 1).toUpperCase()}</span></div>
        </header>
        <main className="portal-main">{renderContent()}</main>
        <footer className="portal-footer"><span><Building2 /> FixMyCity · Connected communities</span><span>Better services. Better neighbourhoods.</span></footer>
      </div>

      {user.role === 'citizen' && <WhatsAppSimulator isOpen={isWASimulatorOpen} onClose={() => setIsWASimulatorOpen(false)} />}
      {isOfficerOrAdmin && <ChatBot />}
    </div>
  );
};

export default App;
