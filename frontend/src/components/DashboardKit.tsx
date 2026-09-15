import type { ElementType, ReactNode } from 'react';
import { ArrowUpRight, Building2, Check, ClipboardList, Construction, Droplets, Lightbulb, Trees, Trash2 } from 'lucide-react';

export function StatusBadge({ value }: { value: string }) {
  const tone = value === 'Resolved' || value === 'Completed' ? 'green' : value === 'Critical' || value === 'Declined' ? 'red' : value === 'High' || value === 'Under Review' || value === 'Awaiting Approval' ? 'amber' : value === 'In Progress' ? 'cyan' : 'blue';
  return <span className={'status-badge tone-' + tone}><i />{value}</span>;
}

export function IssueIcon({ category }: { category: string }) {
  const Icon = /Garbage/.test(category) ? Trash2 : /Water|Flood|Manhole/.test(category) ? Droplets : /Electric|light/.test(category) ? Lightbulb : /Tree/.test(category) ? Trees : Construction;
  return <span className="issue-icon"><Icon aria-hidden="true" /></span>;
}

export function MetricCard({ label, value, detail, icon: Icon, tone = 'blue', onClick }: {
  label: string; value: number; detail: string; icon: ElementType; tone?: string; onClick?: () => void;
}) {
  const content = <><div className="metric-top"><span className="metric-icon"><Icon /></span>{onClick && <ArrowUpRight className="metric-arrow" />}</div><span className="metric-label">{label}</span><strong>{value.toLocaleString('en-IN')}</strong><span className="metric-detail">{detail}</span></>;
  return onClick ? <button className={'metric-card tone-' + tone} onClick={onClick}>{content}</button> : <div className={'metric-card tone-' + tone}>{content}</div>;
}

export function WorkspaceHero({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <header className="workspace-hero"><div className="hero-copy"><span className="work-eyebrow"><span />{eyebrow}</span><h1>{title}</h1><p>{description}</p>{children}</div><div className="civic-scene" aria-hidden="true"><div className="scene-orbit" /><div className="scene-grid" /><span className="scene-building scene-building--one" /><span className="scene-building scene-building--two" /><span className="scene-building scene-building--three" /><span className="scene-seal"><Building2 /></span><span className="scene-check"><Check /></span><span className="scene-label">CONNECTED CITY</span></div></header>;
}

export function CaseProgress({ status }: { status: string }) {
  const steps = ['Reported', 'Inspection', status === 'Declined' ? 'Declined' : 'Verified', 'Work approved', 'Resolved'];
  const active = status === 'Resolved' ? 4 : status === 'In Progress' ? 3 : status === 'Awaiting Approval' || status === 'Declined' ? 2 : status === 'Assigned' ? 1 : 0;
  return <ol className="case-progress" aria-label="Complaint progress">{steps.map((step, index) => <li key={step} className={index <= active ? 'done' : ''} aria-current={index === active ? 'step' : undefined}><span>{index < active ? <Check /> : index + 1}</span><small>{step}</small></li>)}</ol>;
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="work-empty"><span className="empty-icon"><ClipboardList /></span><h3>{title}</h3><p>{children}</p></div>;
}
