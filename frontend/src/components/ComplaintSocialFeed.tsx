import React, { useEffect, useState } from 'react';
import { Clock3, Heart, MapPin, MessageCircle, Send, Share2 } from 'lucide-react';
import { api } from '../lib/apiClient';

type FeedComment = { id: number; user_id: number; username: string; content: string; created_at: string };
type FeedItem = {
  id: number;
  category: string;
  severity: string;
  description: string;
  district: string;
  ward: string;
  status: string;
  before_image_url: string;
  created_at: string;
  author: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  liked_by_me: boolean;
  comments: FeedComment[];
};

const BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:8001`;

export const ComplaintSocialFeed: React.FC = () => {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
  const [error, setError] = useState('');
  const highlightedId = Number(new URLSearchParams(window.location.search).get('complaint')) || null;

  const loadFeed = async () => {
    try {
      setItems(await api.get('/community/complaints-feed'));
    } catch {
      setError('The civic feed could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadFeed(); }, []);
  useEffect(() => {
    if (highlightedId && items.length) {
      window.setTimeout(() => document.getElementById(`complaint-${highlightedId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    }
  }, [highlightedId, items]);

  const toggleLike = async (id: number) => {
    const result = await api.post(`/community/complaints/${id}/like`, {});
    setItems(current => current.map(item => item.id === id ? { ...item, liked_by_me: result.liked, like_count: result.like_count } : item));
  };

  const share = async (item: FeedItem) => {
    const text = `${item.category} reported in ${item.ward}, ${item.district}\n\n${item.description}`;
    try {
      if (navigator.share) await navigator.share({ title: `FixMyCity: ${item.category}`, text });
      else await navigator.clipboard.writeText(text);
    } catch { return; }
    const result = await api.post(`/community/complaints/${item.id}/share`, {});
    setItems(current => current.map(entry => entry.id === item.id ? { ...entry, share_count: result.share_count } : entry));
  };

  const submitComment = async (id: number) => {
    const content = commentDrafts[id]?.trim();
    if (!content) return;
    const comment = await api.post(`/community/complaints/${id}/comments`, { content });
    setItems(current => current.map(item => item.id === id ? { ...item, comments: [...item.comments, comment], comment_count: item.comment_count + 1 } : item));
    setCommentDrafts(current => ({ ...current, [id]: '' }));
  };

  if (loading) return <section className="glass-panel p-10 text-center text-slate-400">Loading civic reports...</section>;
  if (error) return <section className="glass-panel p-6 text-red-300">{error}</section>;

  return (
    <section className="complaint-social-feed" aria-labelledby="complaint-feed-title">
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <span className="section-kicker">PUBLIC CIVIC SIGNALS</span>
          <h2 id="complaint-feed-title" className="text-2xl font-bold text-white">What your city is reporting</h2>
          <p className="text-sm text-slate-400 mt-1">Like, discuss, and share issues so the right people see them.</p>
        </div>
        <span className="text-xs text-cyan-300">{items.length} reports</span>
      </div>
      {!items.length ? <div className="glass-panel p-10 text-center text-slate-400">No civic reports have been published yet.</div> : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {items.map(item => (
            <article key={item.id} id={`complaint-${item.id}`} className={`glass-panel overflow-hidden border border-white/10 bg-[#101b2b] ${highlightedId === item.id ? 'ring-2 ring-cyan-300' : ''}`}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div><p className="text-sm font-bold text-white">{item.author}</p><p className="text-xs text-slate-500">FixMyCity report · {new Date(item.created_at).toLocaleString()}</p></div>
                <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${item.status === 'resolved' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>{item.status.replace('_', ' ')}</span>
              </div>
              <img src={`${BACKEND_URL}${item.before_image_url}`} alt={item.category} className="w-full max-h-[360px] object-cover" />
              <div className="p-5">
                <div className="flex items-center justify-between gap-3"><h3 className="text-xl font-bold text-white">{item.category}</h3><span className="text-xs uppercase font-bold text-orange-300">{item.severity}</span></div>
                <p className="mt-3 text-sm leading-6 text-slate-300 whitespace-pre-wrap">{item.description}</p>
                <p className="mt-3 text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{item.ward}, {item.district}<Clock3 className="w-3.5 h-3.5 ml-2" />{new Date(item.created_at).toLocaleDateString()}</p>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-5 text-sm text-slate-300">
                  <button onClick={() => void toggleLike(item.id)} className={`inline-flex items-center gap-2 transition ${item.liked_by_me ? 'text-rose-300' : 'hover:text-rose-300'}`}><Heart className="w-4 h-4" fill={item.liked_by_me ? 'currentColor' : 'none'} />{item.like_count}</button>
                  <button onClick={() => setOpenComments(current => ({ ...current, [item.id]: !current[item.id] }))} className="inline-flex items-center gap-2 hover:text-cyan-300"><MessageCircle className="w-4 h-4" />{item.comment_count}</button>
                  <button onClick={() => void share(item)} className="inline-flex items-center gap-2 hover:text-cyan-300"><Share2 className="w-4 h-4" />{item.share_count}</button>
                </div>
                {openComments[item.id] && <div className="mt-4 space-y-3">
                  {item.comments.map(comment => <div key={comment.id} className="rounded-lg bg-black/20 px-3 py-2"><p className="text-xs font-bold text-cyan-300">{comment.username}</p><p className="text-sm text-slate-300">{comment.content}</p></div>)}
                  <div className="flex gap-2"><input value={commentDrafts[item.id] || ''} onChange={event => setCommentDrafts(current => ({ ...current, [item.id]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') void submitComment(item.id); }} placeholder="Add a comment..." className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b1422] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" /><button onClick={() => void submitComment(item.id)} aria-label="Post comment" title="Post comment" className="rounded-lg bg-cyan-500 px-3 text-slate-950"><Send className="w-4 h-4" /></button></div>
                </div>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default ComplaintSocialFeed;
