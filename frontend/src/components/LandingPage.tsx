import React from 'react';
import {
  ArrowRight,
  Bot,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  MessageSquare,
  PhoneCall,
  ShieldCheck,
} from 'lucide-react';

interface LandingPageProps {
  onNavigate: (tab: string) => void;
}

const services = [
  { icon: Camera, title: 'Report a civic issue', text: 'Share a photo and location for roads, waste, water, lighting, and more.', accent: 'teal' },
  { icon: ClipboardCheck, title: 'Track your request', text: 'Follow every update from acknowledgement to field resolution.', accent: 'blue' },
  { icon: MessageSquare, title: 'Community notices', text: 'View verified alerts and help your neighbourhood stay informed.', accent: 'orange' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => (
  <div className="civic-home page-transition-enter-active">
    <section className="civic-hero">
      <div className="civic-hero__copy">
        <div className="civic-eyebrow"><ShieldCheck className="h-4 w-4" /> A simpler way to reach city services</div>
        <h1>Better city services,<br /><em>closer to every citizen.</em></h1>
        <p>Report neighbourhood issues, see progress in real time, and connect directly with the teams working for your city.</p>
        <div className="civic-hero__actions"><button onClick={() => onNavigate('login')} className="civic-primary-button"><Camera className="h-4 w-4" />Report an issue <ArrowRight className="h-4 w-4" /></button><button onClick={() => onNavigate('login')} className="civic-secondary-button">Sign in to track a request</button></div>
        <div className="civic-trust-row"><span><CheckCircle2 className="h-4 w-4" />Free public service</span><span><CheckCircle2 className="h-4 w-4" />Photo & location reporting</span><span><CheckCircle2 className="h-4 w-4" />Status updates</span></div>
      </div>
      <div className="civic-hero__visual" aria-label="A preview of the civic issue reporting service">
        <div className="civic-hero__map"><div className="civic-hero__roads" /><span className="civic-map-label civic-map-label--one"><MapPin />Road repair</span><span className="civic-map-label civic-map-label--two"><MapPin />Water service</span><span className="civic-map-label civic-map-label--three"><MapPin />Waste collection</span></div>
        <div className="civic-report-preview"><div className="civic-report-preview__header"><span className="civic-report-preview__avatar"><Camera className="h-4 w-4" /></span><div><b>New report received</b><small>Ward 14 · just now</small></div><span className="civic-report-preview__status">Verified</span></div><div className="civic-report-preview__body"><div className="civic-preview-image"><span><MapPin className="h-5 w-5" /></span></div><div><b>Road surface damage</b><p>AI has identified a likely pothole and sent it to Roads & Infrastructure.</p><div className="civic-mini-progress"><span /></div><small>Department assigned</small></div></div></div>
      </div>
    </section>

    <section className="civic-service-section"><div className="civic-section-heading"><div><p>Services for residents</p><h2>Everything you need to improve your neighbourhood.</h2></div><button onClick={() => onNavigate('login')}>Explore services <ArrowRight className="h-4 w-4" /></button></div><div className="civic-service-grid">{services.map(({ icon: Icon, title, text, accent }) => <article className={`civic-service-card civic-service-card--${accent}`} key={title}><span className="civic-service-card__icon"><Icon className="h-5 w-5" /></span><h3>{title}</h3><p>{text}</p><button onClick={() => onNavigate('login')}>Get started <ArrowRight className="h-4 w-4" /></button></article>)}</div></section>

    <section className="civic-how-section"><div className="civic-how-section__intro"><p>Designed around your time</p><h2>From report to resolution in three clear steps.</h2><span>Every request is assigned a reference and routed to the relevant municipal team.</span></div><div className="civic-steps"><div><span>01</span><Camera className="h-5 w-5" /><h3>Share what you see</h3><p>Upload a photo, add a short note, and confirm your location.</p></div><div><span>02</span><Bot className="h-5 w-5" /><h3>We route it quickly</h3><p>Smart triage directs the report to the right civic department.</p></div><div><span>03</span><CheckCircle2 className="h-5 w-5" /><h3>Follow the outcome</h3><p>Receive updates until the issue is resolved and verified.</p></div></div></section>

    <section className="civic-access-banner"><div className="civic-access-banner__icon"><PhoneCall className="h-6 w-6" /></div><div><p>Need another way to report?</p><h2>Use WhatsApp, voice support, or visit your nearest ward office.</h2><span>Digital services that meet people where they are.</span></div><button onClick={() => onNavigate('login')}>View reporting options <ArrowRight className="h-4 w-4" /></button></section>
  </div>
);

export default LandingPage;
