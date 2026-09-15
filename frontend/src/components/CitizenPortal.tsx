import React, { useEffect, useRef, useState } from 'react';
import { Camera, MapPin, Sparkles, CheckCircle2, ClipboardList, Clock3, ArrowDown, UploadCloud, ShieldCheck } from 'lucide-react';
import { WorkspaceHero, MetricCard, StatusBadge, IssueIcon, CaseProgress, EmptyState } from './DashboardKit';
import { api } from '../lib/apiClient';
import { pollBackend, subscribeToComplaints } from '../lib/simulationEngine';
import type { Complaint } from '../lib/simulationEngine';
import { exactTime } from '../lib/dates';
import { useAuth } from '../contexts/AuthContext';
import { DetectionPreview } from './DetectionPreview';

type Location = { latitude: number; longitude: number; district: string; ward: string; place: string; accuracy?: number };
export const CitizenPortal: React.FC<{ onNavigate?: (tab: string) => void; onOpenSimulator?: () => void }> = () => {
  const { user } = useAuth();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [location, setLocation] = useState<Location | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [description, setDescription] = useState('');
  const [locating, setLocating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [ticket, setTicket] = useState<number | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const generation = useRef(0);
  const photoInput = useRef<HTMLInputElement>(null);
  useEffect(() => subscribeToComplaints(setComplaints), []);
  useEffect(() => { if (!photo) { setPreview(''); return; } const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);

  const captureLocation = async (version: number): Promise<Location | null> => {
    setLocating(true); setLocationError('');
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation
        ? navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
        : reject(new Error('Location unavailable')));
      const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
      let result: Location = { ...coordinates, district: '', ward: '', place: '' };
      try { result = { ...result, ...await api.get('/locations/reverse?latitude=' + coordinates.latitude + '&longitude=' + coordinates.longitude) }; }
      catch { if (version === generation.current) setLocationError('Coordinates captured. Enter the place and district below while name lookup is unavailable.'); }
      if (version === generation.current) setLocation(result);
      return result;
    } catch {
      if (version === generation.current) setLocationError('Allow browser location access, then click Detect location. Your device must be at the incident location.');
      return null;
    } finally { if (version === generation.current) setLocating(false); }
  };
  const scan = async (file: File, point: Location, version: number) => {
    setScanning(true); setError('');
    try {
      const form = new FormData();
      form.append('file', file); form.append('latitude', String(point.latitude)); form.append('longitude', String(point.longitude));
      form.append('district', point.district || 'Location pending'); form.append('ward', point.ward || 'Place pending');
      const result = await api.postFormData('/complaints/analyze', form);
      if (version === generation.current) setAnalysis(result);
    } catch { if (version === generation.current) setError('Image analysis failed. Please retry the scan.'); }
    finally { if (version === generation.current) setScanning(false); }
  };
  const startPhoto = async (file: File) => {
    const version = ++generation.current;
    setPhoto(file); setAnalysis(null); setLocation(null); setDescription(''); setError(''); setTicket(null); setScanning(false);
    const point = await captureLocation(version);
    if (point && version === generation.current) await scan(file, point, version);
  };
  const detectLocation = async () => {
    const version = ++generation.current;
    setAnalysis(null); setDescription(''); setLocation(null);
    const point = await captureLocation(version);
    if (point && photo && version === generation.current) await scan(photo, point, version);
  };
  const generateDescription = () => {
    if (!analysis || !location) return;
    setDescription('A ' + analysis.category.toLowerCase() + ' has been reported at ' + location.ward + ', ' + location.district +
      '. Coordinates: ' + location.latitude.toFixed(6) + ', ' + location.longitude.toFixed(6) +
      '. The image assessment indicates ' + analysis.severity + ' priority. Please inspect the site and route the required work to ' + analysis.department?.name + '.');
  };
  const submit = async () => {
    if (!analysis || !location || !location.district.trim() || !location.ward.trim()) return;
    setSubmitting(true); setError('');
    try {
      const result = await api.post('/complaints', { category: analysis.category, description: description.trim() || null,
        latitude: location.latitude, longitude: location.longitude, district: location.district.trim(), ward: location.ward.trim(), before_image_url: analysis.before_image_url });
      setTicket(result.id); await pollBackend();
    } catch { setError('The complaint could not be submitted. Please try again.'); }
    finally { setSubmitting(false); }
  };
  const myComplaints = complaints.filter(item => item.citizenId === user?.id);
  const busy = locating || scanning || submitting;
  return <section className="work-page citizen-workspace">
    <WorkspaceHero eyebrow="YOUR NEIGHBOURHOOD. YOUR VOICE." title="Small reports. Real change." description={'Welcome, ' + (user?.username || 'citizen') + '. Help your community move forward. Report an issue and follow its journey to resolution.'}>
      <div className="hero-actions"><a className="work-primary" href="#new-report"><Camera />Report an issue</a><a className="hero-link" href="#my-reports">Track my reports <ArrowDown /></a></div>
    </WorkspaceHero>
    <div className="dashboard-metrics metrics-three">
      <MetricCard label="My reports" value={myComplaints.length} detail="Every report makes a difference" icon={ClipboardList} />
      <MetricCard label="In the works" value={myComplaints.filter(item => !['Resolved','Declined'].includes(item.status)).length} detail="Follow progress below" icon={Clock3} tone="amber" />
      <MetricCard label="Resolved" value={myComplaints.filter(item => item.status === 'Resolved').length} detail="Completed in your community" icon={CheckCircle2} tone="green" />
    </div>
    <div className="section-intro" id="new-report"><div><span className="section-kicker">CITIZEN REPORTING DESK</span><h2>Report a civic issue</h2></div><span className="quiet-label"><ShieldCheck />You review before submitting</span></div>
    {!ticket && <ol className="report-steps" aria-label="Reporting steps">{[{ label: 'Add a photo', text: 'Capture the issue', done: !!photo }, { label: 'Confirm location', text: 'Place and coordinates', done: !!location?.ward && !!location?.district }, { label: 'Review & submit', text: 'Make your report count', done: false }].map((step, index) => <li key={step.label} className={step.done ? 'complete' : ''}><span>{step.done ? <CheckCircle2 /> : String(index + 1).padStart(2, '0')}</span><div><strong>{step.label}</strong><small>{step.text}</small></div></li>)}</ol>}
    {ticket ? <section className="work-card submission-success" role="status"><CheckCircle2 /><h2>Complaint submitted</h2><p>Your reference is <strong>CS-{String(ticket).padStart(4, '0')}</strong>. The Central Room will review your report.</p><button className="work-primary" onClick={() => { ++generation.current; setTicket(null); setPhoto(null); setAnalysis(null); setDescription(''); setLocation(null); }}>Report another issue</button></section> :
    <div className="citizen-report-grid">
      <section className="work-card report-compose"><div className="work-card-title"><div><span className="section-kicker">THE ISSUE</span><h2>Photo and description</h2></div><Camera /></div><p className="work-muted">Location capture starts when you select a photo. Allow access when your browser asks.</p>
        <input ref={photoInput} type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (file) void startPhoto(file); }} className="work-file" aria-label="Issue photo" />
        {preview ? <DetectionPreview src={preview} locating={locating} scanning={scanning} detections={analysis?.detections} /> : <button className="photo-placeholder" onClick={() => photoInput.current?.click()}><span className="upload-art"><UploadCloud /></span><strong>A clearer picture. A faster response.</strong><span>Choose a photo <span aria-hidden="true">↗</span></span><small>Use a clear, well-lit image of the civic issue.</small><span className="upload-categories">Roads · Waste · Water · Street lighting</span></button>}
        {preview && <button className="work-secondary" disabled={busy} onClick={() => photoInput.current?.click()}>Change photo</button>}
        <div className="description-heading"><label htmlFor="citizen-description">Description</label><button className="work-secondary" disabled={!analysis || busy || !location?.district || !location?.ward || analysis.category === 'None'} onClick={generateDescription}><Sparkles />Generate with AI</button></div>
        <textarea id="citizen-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="Describe the issue, or click Generate with AI." rows={8} />
      </section>
      <section className="work-card report-review"><div className="work-card-title"><div><span className="section-kicker">REPORT DETAILS</span><h2>Location and review</h2></div><MapPin /></div>
        {!location && !locating && <div className="location-placeholder"><MapPin /><strong>Put the issue on the map</strong><p>Your device location is captured when you add a photo. You can confirm the place name before sending.</p></div>}
        <div className="report-location" aria-live="polite"><MapPin /><div><strong>{locating ? 'Detecting your location…' : location?.place || (location?.ward ? location.ward + ', ' + location.district : 'Location not yet confirmed')}</strong>
          {location && <><p className="coordinates">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p><small>Device accuracy: approximately {Math.round(location.accuracy || 0)} m</small></>}</div></div>
        <button className="work-secondary" onClick={() => void detectLocation()} disabled={busy}><MapPin />{locating ? 'Detecting…' : 'Detect location'}</button>
        {locationError && <p role="status" className="work-warning">{locationError}</p>}
        {location && <div className="work-form-grid"><label>Place / locality<input value={location.ward} onChange={event => { setLocation({ ...location, ward: event.target.value, place: '' }); setDescription(''); }} /></label><label>District<input value={location.district} onChange={event => { setLocation({ ...location, district: event.target.value, place: '' }); setDescription(''); }} /></label></div>}
        <p className="work-muted">Confirm this is where the incident occurred. Place names © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>.</p>
        {scanning && <p className="work-notice" role="status">Detecting issue… Please keep this page open.</p>}
        {analysis && <div className={'detected-issue ' + (analysis.category === 'None' ? 'no-detection' : '')} role="status"><span className="section-kicker">DETECTED ISSUE · CLIP SUGGESTION</span><div><IssueIcon category={analysis.category} /><h2>{analysis.category === 'None' ? 'Unable to identify an issue confidently' : analysis.category}</h2></div><p>{analysis.category === 'None' ? 'Try a clearer, closer photo showing the damage or waste.' : analysis.severity + ' priority · officer verification required'}</p><small>{analysis.detections?.length ? 'The green outline is an approximate CLIP matching region, not an exact object boundary.' : 'No reliable area could be highlighted for this photo.'}</small></div>}
        {analysis && analysis.category !== 'None' && <dl className="work-details"><div><dt>Suggested issue</dt><dd>{analysis.category}</dd></div><div><dt>Priority</dt><dd>{analysis.severity}</dd></div><div><dt>Department</dt><dd>{analysis.department?.name}</dd></div><div><dt>Relative model match</dt><dd>{Math.round(analysis.confidence * 100)}%<small>Not a probability of correctness</small></dd></div></dl>}
        {error && <p className="work-error" role="alert">{error}</p>}
        {photo && location && !analysis && !busy && <button className="work-secondary" onClick={() => void scan(photo, location, generation.current)}>Retry scan</button>}
        <button className="work-primary work-submit" disabled={busy || !analysis || analysis.category === 'None' || !location?.district.trim() || !location?.ward.trim()} onClick={() => void submit()}>{submitting ? 'Submitting…' : 'Submit complaint'}</button>
      </section>
    </div>}
    <section className="work-card citizen-tracking" id="my-reports"><div className="work-card-title"><div><span className="section-kicker">YOUR REPORTS, IN ONE PLACE</span><h2>My complaints</h2></div><span className="work-count">{myComplaints.length} reports</span></div>
      {myComplaints.length ? <div className="tracking-grid">{myComplaints.map(item => <article className="tracking-card" key={item.id}><header><IssueIcon category={item.category} /><div><small>{item.id}</small><h3>{item.category}</h3></div><StatusBadge value={item.status} /></header><p className="tracking-location"><MapPin />{item.location.address}</p><time>{exactTime(item.timestamp)}</time><CaseProgress status={item.status} /><details><summary>View report details</summary><p className="full-description">{item.description || 'No description supplied.'}</p><p className="coordinates">{item.location.lat.toFixed(6)}, {item.location.lng.toFixed(6)}</p><p className="work-muted">Assigned to: {item.assignedOfficer || 'Awaiting assignment'}</p></details></article>)}</div> : <EmptyState title="Your next report starts a change">Once submitted, your reports and their progress will appear here.</EmptyState>}
    </section>
  </section>;
};
export default CitizenPortal;
