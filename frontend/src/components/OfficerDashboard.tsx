import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, MapPin, Search, ClipboardList, CheckCircle2, Activity, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { WorkspaceHero, MetricCard, StatusBadge, IssueIcon, CaseProgress, EmptyState } from './DashboardKit';
import { api, BACKEND_URL } from '../lib/apiClient';
import { pollBackend, subscribeToComplaints } from '../lib/simulationEngine';
import type { Complaint } from '../lib/simulationEngine';
import { exactTime } from '../lib/dates';
import { useAuth } from '../contexts/AuthContext';

export const OfficerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Active');
  const [action, setAction] = useState('real');
  const [evidence, setEvidence] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => subscribeToComplaints(setComplaints), []);
  useEffect(() => { if (!evidence) { setEvidencePreview(''); return; } const url = URL.createObjectURL(evidence); setEvidencePreview(url); return () => URL.revokeObjectURL(url); }, [evidence]);
  const mine = complaints.filter(item => item.officerUserId === user?.id);
  const selected = mine.find(item => item.id === selectedId);
  const visible = mine.filter(item => (filter === 'Completed' ? item.status === 'Resolved' : filter === 'Declined' ? item.status === 'Declined' : !['Resolved','Declined'].includes(item.status)) &&
    (item.id + ' ' + item.category + ' ' + item.location.address).toLowerCase().includes(query.toLowerCase()));
  const openCase = (item: Complaint) => { setSelectedId(item.id); setAction(item.status === 'In Progress' ? 'resolved' : 'real'); setEvidence(null); setNotes(''); setMessage(''); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true); setMessage('');
    try {
      const id = Number(selected.id.replace(/\D/g, ''));
      if (!evidence || !notes.trim()) throw new Error('Add an on-site photo and your findings before submitting.');
      const form = new FormData(); form.append('file', evidence); form.append('notes', notes.trim());
      if (selected.status === 'In Progress') await api.postFormData('/complaints/' + id + '/complete', form);
      else if (selected.status === 'Assigned') { form.append('verdict', action); await api.postFormData('/complaints/' + id + '/verify', form); }
      else throw new Error('This complaint is not ready for an officer update.');
      await pollBackend(); setSelectedId(null); setMessage(selected.status === 'In Progress' ? 'Resolution submitted successfully.' : action === 'fake' ? 'Report declined with inspection evidence.' : 'Inspection submitted. Waiting for the Central Room to proceed.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Update failed. Please try again.'); }
    finally { setBusy(false); }
  };
  return <section className="work-page officer-simple">
    {selected ? <header className="work-heading"><div><span className="work-eyebrow">FIELD OPERATIONS / {selected.id}</span><h1>{selected.category}</h1><p>Review the report and submit your work update.</p></div><StatusBadge value={selected.status} /></header> : <>
      <WorkspaceHero eyebrow={'FIELD OPERATIONS / ' + user?.username} title="My assigned complaints" description="Good work starts with a clear next step. Review your assignments, take action on site, and keep citizens informed."><div className="hero-note"><ShieldCheck />Your assignments. Your focused workspace.</div></WorkspaceHero>
      <div className="dashboard-metrics metrics-three"><MetricCard label="Active assignments" value={mine.filter(item => !['Resolved','Declined'].includes(item.status)).length} detail="Your current work queue" icon={ClipboardList} /><MetricCard label="Work in progress" value={mine.filter(item => item.status === 'In Progress').length} detail="Cases you've started" icon={Activity} tone="cyan" /><MetricCard label="Completed" value={mine.filter(item => item.status === 'Resolved').length} detail="Work submitted with evidence" icon={CheckCircle2} tone="green" /></div>
    </>}
    {message && <p className="work-notice" role="status">{message}</p>}
    {selected ? <>
      <button className="work-secondary" disabled={busy} onClick={() => setSelectedId(null)}><ArrowLeft />Back to complaints</button>
      <div className="officer-detail-grid">
        <section className="work-card"><div className="work-card-title"><div><span className="section-kicker">KNOW THE ISSUE</span><h2>Complaint details</h2></div><StatusBadge value={selected.severity} /></div><CaseProgress status={selected.status} />
          {selected.beforeImage && <img className="report-photo" src={selected.beforeImage.startsWith('http') ? selected.beforeImage : BACKEND_URL + selected.beforeImage} alt="Reported issue" />}
          <dl className="work-details"><div><dt>Reference</dt><dd>{selected.id}</dd></div><div><dt>Reported at</dt><dd>{exactTime(selected.timestamp)}</dd></div><div><dt>Priority</dt><dd>{selected.severity}</dd></div><div><dt>Department</dt><dd>{selected.department}</dd></div></dl>
          <div className="report-location"><MapPin /><div><strong>{selected.location.address}</strong><p className="coordinates">{selected.location.lat.toFixed(6)}, {selected.location.lng.toFixed(6)}</p><a href={'https://www.google.com/maps/dir/?api=1&destination=' + selected.location.lat + ',' + selected.location.lng} target="_blank" rel="noreferrer">Open directions</a></div></div>
          <h3>Description</h3><p className="full-description">{selected.description || 'No description supplied.'}</p>
        </section>
        <form className="work-card officer-action-form" onSubmit={submit}><div className="work-card-title"><div><span className="section-kicker">YOUR NEXT ACTION</span><h2>Update this complaint</h2></div><ArrowUpRight /></div><p className="work-muted">Record what happened on site. Your update keeps the Central Room and citizen informed.</p>
          {selected.status === 'Resolved' ? <p>This complaint is completed. No further action is required.</p> : selected.status === 'Declined' ? <p>This report was declined after inspection. {selected.verificationNotes}</p> : selected.status === 'Awaiting Approval' ? <p className="work-notice">Real issue confirmed. Waiting for the Central Room to click Proceed. Work remains assigned to you.</p> : <>
            <label>Action<select value={action} onChange={event => setAction(event.target.value)} disabled={busy}>
              {selected.status === 'Assigned' ? <><option value="real">Confirm real issue</option><option value="fake">Decline — fake / not genuine</option></> : <option value="resolved">Submit completed work</option>}
            </select></label>
            <label>{selected.status === 'Assigned' ? 'Inspection findings' : 'Work notes'}<textarea rows={5} required value={notes} onChange={event => setNotes(event.target.value)} placeholder={action === 'fake' ? 'Explain why the reported issue could not be verified on site.' : 'Describe the inspection or work completed.'} /></label>
            <label>{selected.status === 'Assigned' ? 'On-site verification photo' : 'After-work photo'}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required onChange={event => setEvidence(event.target.files?.[0] || null)} /><small>{selected.status === 'Assigned' ? 'Take a photo at the reported location to support your real / fake decision.' : 'Take a new photo showing the completed work.'} JPEG, PNG or WebP, up to 12 MB.</small></label>
            {evidencePreview && <figure><img className="report-photo" src={evidencePreview} alt="Photo selected as on-site evidence" /><figcaption className="work-muted">Selected evidence photo. Confirm it shows the reported site before submitting.</figcaption></figure>}
            <button className="work-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit update'}</button>
          </>}
        </form>
      </div>
    </> : <section className="work-card officer-queue"><div className="work-card-title"><div><span className="section-kicker">YOUR WORK QUEUE</span><h2>Assigned to you</h2></div><span className="work-count">{visible.length} complaints</span></div><div className="work-toolbar"><label className="work-search"><Search /><input aria-label="Search assigned complaints" placeholder="Search complaint or location" value={query} onChange={event => setQuery(event.target.value)} /></label><div className="work-tabs">{['Active', 'Completed', 'Declined'].map(item => <button key={item} aria-pressed={filter === item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
      <div className="simple-case-list">{visible.map(item => <button key={item.id} onClick={() => openCase(item)}><IssueIcon category={item.category} /><div><small className="case-reference">{item.id} · {item.department}</small><strong>{item.category}</strong><p><MapPin />{item.location.address}</p><time>{exactTime(item.timestamp)}</time></div><span className="case-badges"><StatusBadge value={item.severity} /><StatusBadge value={item.status} /></span><span className="case-open">Open case <ChevronRight /></span></button>)}</div>
      {!visible.length && <EmptyState title={filter === 'Active' ? 'No active assignments' : filter === 'Declined' ? 'No declined complaints' : 'No completed complaints'}>Complaints assigned to your account by the Central Room appear here.</EmptyState>}
    </section>}
  </section>;
};
export default OfficerDashboard;
