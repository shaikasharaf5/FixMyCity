import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Search, UserRoundCheck, ClipboardList, Clock3, CheckCircle2, Activity, Layers, ArrowUpRight } from 'lucide-react';
import { api, BACKEND_URL } from '../lib/apiClient';
import { MetricCard, StatusBadge, IssueIcon, CaseProgress, EmptyState } from './DashboardKit';
import { pollBackend, subscribeToComplaints } from '../lib/simulationEngine';
import type { Complaint } from '../lib/simulationEngine';
import { exactTime, timeAgo } from '../lib/dates';

interface Officer { id: number; user: { username: string }; department: { id: number; name: string }; district: string }
const priority: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
function Focus({ selected }: { selected?: Complaint }) {
  const map = useMap();
  const latitude = selected?.location.lat;
  const longitude = selected?.location.lng;
  useEffect(() => { if (latitude !== undefined && longitude !== undefined) map.setView([latitude, longitude], 15); }, [latitude, longitude, map]);
  useEffect(() => { const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(map.getContainer()); return () => observer.disconnect(); }, [map]);
  return null;
}
const icon = (item: Complaint, selected: boolean) => L.divIcon({ className: 'incident-pin', html: '<span style="background:' + (item.severity === 'Critical' ? '#dc2626' : item.severity === 'High' ? '#d97706' : '#2563eb') + ';outline:' + (selected ? '4px solid #93c5fd' : 'none') + '"></span>', iconSize: [20,20] });
export const GovDashboard: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [officerId, setOfficerId] = useState('');
  const [district, setDistrict] = useState('All districts');
  const [filter, setFilter] = useState('Active');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('Newest first');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => subscribeToComplaints(setComplaints), []);
  useEffect(() => { api.get('/departments/officers').then(setOfficers).catch(() => setNotice('Officer list could not be loaded. Refresh to retry.')); const timer = window.setInterval(() => tick(value => value + 1), 1000); return () => window.clearInterval(timer); }, []);
  const districts = useMemo(() => [...new Set(complaints.map(item => item.district))].sort(), [complaints]);
  const inDistrict = complaints.filter(item => district === 'All districts' || item.district === district);
  const visible = inDistrict.filter(item => (filter === 'Completed' ? item.status === 'Resolved' : filter === 'Declined' ? item.status === 'Declined' : !['Resolved','Declined'].includes(item.status)) &&
    (filter !== 'Awaiting Approval' || item.status === 'Awaiting Approval') &&
    (filter !== 'Critical' || item.severity === 'Critical') && (filter !== 'Unassigned' || !item.assignedOfficer) &&
    (item.id + ' ' + item.category + ' ' + item.location.address + ' ' + item.department).toLowerCase().includes(query.toLowerCase()))
    .sort((a,b) => sort === 'Oldest first' ? a.timestamp.getTime() - b.timestamp.getTime() : sort === 'Priority first' ? priority[b.severity] - priority[a.severity] || b.timestamp.getTime() - a.timestamp.getTime() : b.timestamp.getTime() - a.timestamp.getTime());
  const selected = visible.find(item => item.id === selectedId) || visible[0];
  const matching = officers.filter(item => item.department.id === selected?.departmentId);
  useEffect(() => { setOfficerId(''); }, [selected?.id]);
  useEffect(() => { setPage(0); }, [district, query, filter, sort]);
  const pages = Math.max(1, Math.ceil(visible.length / 8));
  const currentPage = Math.min(page, pages - 1);
  const update = async (status: 'assigned' | 'under_review') => {
    if (!selected || busy || (status === 'assigned' && !officerId)) return;
    setBusy(true); setNotice('');
    try {
      await api.put('/complaints/' + Number(selected.id.replace(/\D/g, '')), { status, ...(status === 'assigned' ? { officer_id: Number(officerId) } : {}) });
      await pollBackend(); setNotice(status === 'assigned' ? 'Complaint assigned successfully.' : 'Complaint moved to review.');
    } catch { setNotice('The update could not be saved. Check your connection and try again.'); }
    finally { setBusy(false); }
  };
  const proceed = async () => {
    if (!selected || busy) return;
    setBusy(true); setNotice('');
    try { await api.post('/complaints/' + Number(selected.id.replace(/\D/g,'')) + '/proceed', {}); await pollBackend(); setNotice('Work approved. The same officer can now carry out and complete the repair.'); }
    catch { setNotice('Proceed failed. A real inspection and photo must be submitted first.'); }
    finally { setBusy(false); }
  };
  return <section className="work-page central-simple">
    <header className="work-heading"><div><span className="work-eyebrow">OPERATIONS / OVERVIEW</span><h1>Central Control Room<span className="heading-period">.</span></h1><p>Your city at a glance. Every report, a step towards a better neighbourhood.</p></div><label className="district-select"><span><MapPin />District workspace</span><select aria-label="District" value={district} onChange={event => setDistrict(event.target.value)}><option>All districts</option>{districts.map(name => <option key={name}>{name}</option>)}</select></label></header>
    {notice && <p className="work-notice" role="status">{notice}</p>}
    <div className="dashboard-metrics">
      <MetricCard label="Open complaints" value={inDistrict.filter(item => !['Resolved','Declined'].includes(item.status)).length} detail="View the active queue" icon={ClipboardList} onClick={() => setFilter('Active')} />
      <MetricCard label="Awaiting assignment" value={inDistrict.filter(item => !item.assignedOfficer && !['Resolved','Declined'].includes(item.status)).length} detail="Ready for officer allocation" icon={Clock3} tone="amber" onClick={() => setFilter('Unassigned')} />
      <MetricCard label="Work in progress" value={inDistrict.filter(item => item.status === 'In Progress').length} detail="Officers working on site" icon={Activity} tone="cyan" />
      <MetricCard label="Completed" value={inDistrict.filter(item => item.status === 'Resolved').length} detail="View resolved complaints" icon={CheckCircle2} tone="green" onClick={() => setFilter('Completed')} />
    </div>
    <div className="attention-strip"><span className="attention-icon"><Layers /></span><div><strong>Officer inspections ready for review</strong><span>{inDistrict.filter(item => item.status === 'Awaiting Approval').length} verified reports are waiting for the Central Room to proceed.</span></div><button onClick={() => setFilter('Awaiting Approval')}>Review verifications <ArrowUpRight /></button></div>
    <div className="central-operating-grid">
      <section className="work-card complaint-register"><div className="work-card-title"><div><span className="section-kicker">REVIEW & DISPATCH</span><h2>Complaint register</h2></div><span className="work-count">{visible.length} reports</span></div>
        <div className="work-toolbar"><label className="work-search"><Search /><input aria-label="Search complaints" placeholder="Search reference, issue or place" value={query} onChange={event => setQuery(event.target.value)} /></label></div><div className="register-filters"><label>Status<select aria-label="Filter complaints" value={filter} onChange={event => setFilter(event.target.value)}>{['Active', 'Critical', 'Unassigned', 'Awaiting Approval', 'Completed', 'Declined'].map(value => <option key={value}>{value}</option>)}</select></label><label>Sort by date / priority<select aria-label="Sort complaints" value={sort} onChange={event => setSort(event.target.value)}>{['Newest first','Oldest first','Priority first'].map(value => <option key={value}>{value}</option>)}</select></label></div>
        <div className="register-heading"><span>Complaint / place</span><span>Reported at</span><span>Status</span></div>
        <div className="register-list">{visible.slice(currentPage * 8, currentPage * 8 + 8).map(item => <button className={selected?.id === item.id ? 'selected' : ''} key={item.id} onClick={() => setSelectedId(item.id)} aria-pressed={selected?.id === item.id}>
          <span className="register-identity"><IssueIcon category={item.category} /><span><strong>{item.category}</strong><small>{item.id} · {item.severity} priority</small><span className="register-place">{item.location.address}</span></span></span>
          <span><time dateTime={item.timestamp.toISOString()}>{exactTime(item.timestamp)}</time><small>{timeAgo(item.timestamp)}</small></span>
          <StatusBadge value={item.status} />
        </button>)}</div>
        {!visible.length && <EmptyState title="You're all caught up">No complaints match these filters. Choose another status or district.</EmptyState>}
        <div className="work-pagination"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {pages}</span><button disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>
      </section>
      <aside className="work-card dispatch-card"><div className="work-card-title"><div><span className="section-kicker">CASE WORKSPACE</span><h2>Review and assign</h2></div><UserRoundCheck /></div>{selected ? <>
        <div className="dispatch-summary"><span className="work-eyebrow">{selected.id}</span><h3>{selected.category}</h3><StatusBadge value={selected.severity} /></div>
        {selected.beforeImage && <img className="dispatch-photo" alt="Reported issue" src={selected.beforeImage.startsWith('http') ? selected.beforeImage : BACKEND_URL + selected.beforeImage} />}
        <CaseProgress status={selected.status} />
        <div className="report-location"><MapPin /><div><strong>{selected.location.address}</strong><p className="coordinates">{selected.location.lat.toFixed(6)}, {selected.location.lng.toFixed(6)}</p></div></div>
        <dl className="work-details"><div><dt>Reported at</dt><dd>{exactTime(selected.timestamp)}</dd></div><div><dt>Department</dt><dd>{selected.department}</dd></div><div><dt>Assigned to</dt><dd>{selected.assignedOfficer || 'Not assigned'}</dd></div><div><dt>Channel</dt><dd>{selected.source}</dd></div></dl>
        <h3>Report description</h3><p className="full-description">{selected.description || 'No description supplied.'}</p>
        {selected.verificationImage && <section className="verification-evidence"><h3>Officer inspection: {selected.verificationOutcome === 'fake' ? 'Declined / not genuine' : 'Real issue confirmed'}</h3><img className="dispatch-photo" src={selected.verificationImage.startsWith('http') ? selected.verificationImage : BACKEND_URL + selected.verificationImage} alt="Officer on-site verification" /><p className="full-description">{selected.verificationNotes}</p></section>}
        {selected.status === 'Awaiting Approval' && <div className="dispatch-actions"><p>Proceed will authorise <strong>{selected.assignedOfficer}</strong> to perform the work. The assigned officer will not change.</p><button className="work-primary" disabled={busy} onClick={() => void proceed()}>{busy ? 'Approving…' : 'Proceed with work'}</button></div>}
        {selected.status === 'In Progress' && <p className="work-notice">Work approved for {selected.assignedOfficer}. Waiting for the completed-work photo.</p>}
        {selected.status === 'Declined' && <p className="work-warning">Officer declined this report after on-site verification. No repair work is authorised.</p>}
        {selected.completionImage && <section><h3>Completed-work evidence</h3><img className="dispatch-photo" src={selected.completionImage.startsWith('http') ? selected.completionImage : BACKEND_URL + selected.completionImage} alt="Completed repair" /></section>}
        {['Submitted','Under Review','Assigned'].includes(selected.status) && <div className="dispatch-actions"><label>Responsible officer<select value={officerId} onChange={event => setOfficerId(event.target.value)} disabled={busy}><option value="">Select an officer</option>{matching.map(item => <option key={item.id} value={item.id}>{item.user.username} · {item.district}</option>)}</select></label>
          {!matching.length && <p className="work-muted">No officer is configured for this department.</p>}
          <button className="work-primary" disabled={busy || !officerId} onClick={() => void update('assigned')}><UserRoundCheck />{busy ? 'Saving…' : 'Assign complaint'}</button>
          {selected.status === 'Submitted' && <button className="work-secondary" disabled={busy} onClick={() => void update('under_review')}>Mark as under review</button>}
        </div>}
      </> : <p className="work-empty">Select a complaint to view its details.</p>}</aside>
      <section className="work-card central-map-section"><div className="work-card-title"><div><span className="section-kicker">SPATIAL OVERVIEW</span><h2>Complaint locations</h2></div><span className="map-count"><MapPin />{visible.length} reports</span></div>
        <div className="work-map"><MapContainer center={[17.4485,78.3741]} zoom={11} className="h-full w-full"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' /><Focus selected={selected} />{visible.filter(item => Number.isFinite(item.location.lat) && Number.isFinite(item.location.lng)).map(item => <Marker key={item.id} position={[item.location.lat,item.location.lng]} icon={icon(item, item.id === selected?.id)} eventHandlers={{ click: () => setSelectedId(item.id) }}><Tooltip>{item.category} · {item.location.address}</Tooltip></Marker>)}</MapContainer></div>
        <div className="map-legend"><span><i className="legend-critical" />Critical</span><span><i className="legend-high" />High priority</span><span><i className="legend-other" />Other reports</span><small>Click a pin to review</small></div>
      </section>
    </div>
  </section>;
};
export default GovDashboard;
