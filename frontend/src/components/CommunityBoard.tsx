import React, { useState, useEffect, useRef } from 'react';
import { Users, AlertCircle, Heart, Search, Upload, Plus, X, Image as ImageIcon, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { api } from '../lib/apiClient';
import { useAuth } from '../contexts/AuthContext';

interface CommunityPost {
  id: number;
  title: string;
  content: string;
  category: string;
  contact_info: string;
  image_url: string;
  status: string;
  created_at: string;
  user_id: number;
}

export const CommunityBoard: React.FC = () => {
  const { user, isOfficerOrAdmin } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [pendingPosts, setPendingPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPending, setLoadingPending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Missing Person');
  const [contactInfo, setContactInfo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPosts();
    if (isOfficerOrAdmin) {
      fetchPendingPosts();
    }
  }, [isOfficerOrAdmin]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const data = await api.get('/community');
      setPosts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingPosts = async () => {
    setLoadingPending(true);
    try {
      const data = await api.get('/community/pending');
      setPendingPosts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let uploadedImageUrl = '';
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await api.postFormData('/community/upload-image', formData);
        uploadedImageUrl = uploadRes.image_url;
      }
      
      const newPost = await api.post('/community', {
        title,
        content,
        category,
        contact_info: contactInfo,
        image_url: uploadedImageUrl
      });
      
      setShowForm(false);
      setTitle('');
      setContent('');
      setContactInfo('');
      setFile(null);
      setPreview(null);

      if (newPost.status === 'pending') {
        setSuccessMessage("Your alert has been submitted and is awaiting officer review before being published.");
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setSuccessMessage("Alert broadcasted successfully!");
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchPosts();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to create post");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (id: number, action: 'approve' | 'reject') => {
    try {
      await api.put(`/community/${id}/review`, { action });
      fetchPendingPosts();
      if (action === 'approve') {
        fetchPosts(); // Refresh public board
      }
    } catch (err) {
      console.error(err);
      alert("Failed to review post");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    try {
      await api.delete(`/community/${id}`);
      fetchPosts();
    } catch (err) {
      console.error(err);
      alert("Failed to delete post");
    }
  };

  const getCategoryIcon = (cat: string) => {
    if (cat.includes('Missing') || cat.includes('Alert')) return <AlertCircle className="w-4 h-4 text-red-400" />;
    if (cat.includes('Blood') || cat.includes('Pet')) return <Heart className="w-4 h-4 text-emerald-400" />;
    return <Users className="w-4 h-4 text-cyan-400" />;
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto page-transition-enter-active">
      
      <div className="flex justify-between items-end mb-2">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-cyan-500" /> Community Board
          </h1>
          <p className="text-cyan-400 font-medium mt-1">Local alerts, missing items, and public assistance.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.3)] transition"
        >
          {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> Create Alert</>}
        </button>
      </div>

      {successMessage && (
        <div className="bg-emerald-900/40 border border-emerald-500/50 text-emerald-300 p-4 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {showForm && (
        <div className="glass-panel p-6 border-t-2 border-t-violet-500 animate-fade-in mb-4">
           <h2 className="text-lg font-bold text-white mb-4">Publish Community Alert</h2>
           <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Title</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-violet-500 focus:outline-none" placeholder="e.g. Missing Golden Retriever" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-violet-500 focus:outline-none appearance-none">
                    <option>Missing Person</option>
                    <option>Lost Pet</option>
                    <option>Lost Item</option>
                    <option>Blood Donation Needed</option>
                    <option>General Alert</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Description</label>
                <textarea value={content} onChange={e => setContent(e.target.value)} required rows={3} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-violet-500 focus:outline-none" placeholder="Provide detailed information..." />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Info (Optional)</label>
                <input type="text" value={contactInfo} onChange={e => setContactInfo(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-white focus:border-violet-500 focus:outline-none" placeholder="Phone number or email" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Upload Photo</label>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-[#111827] hover:bg-[#1f2937] border border-white/10 rounded-lg text-sm text-slate-300 transition">
                    <Upload className="w-4 h-4" /> Select Image
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                  {preview && (
                    <div className="w-12 h-12 rounded border border-white/20 overflow-hidden">
                       <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end mt-2">
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-lg transition disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Submit Alert'}
                </button>
              </div>
           </form>
        </div>
      )}

      {/* --- Officer/Admin Pending Alerts Section --- */}
      {isOfficerOrAdmin && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-amber-500 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> Pending Alerts for Review ({pendingPosts.length})
          </h2>
          {loadingPending ? (
            <div className="flex justify-center p-6"><div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : pendingPosts.length === 0 ? (
            <div className="glass-panel p-6 text-center text-slate-400 text-sm border-amber-500/20 bg-amber-950/10">
              No pending alerts.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingPosts.map(post => (
                <div key={post.id} className="glass-panel overflow-hidden border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)] flex flex-col bg-amber-950/10">
                  
                  {post.image_url ? (
                    <div className="h-40 w-full bg-[#111827] relative overflow-hidden">
                      <img src={`http://127.0.0.1:8001${post.image_url}`} alt={post.title} className="w-full h-full object-cover opacity-80" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <div className="absolute bottom-3 left-3 bg-amber-600/90 backdrop-blur px-2 py-1 rounded text-xs font-bold text-white flex items-center gap-1">
                        PENDING REVIEW
                      </div>
                    </div>
                  ) : (
                    <div className="h-20 w-full bg-gradient-to-tr from-amber-900/40 to-amber-800/40 relative flex items-center p-4">
                      <div className="bg-amber-600/90 backdrop-blur px-2 py-1 rounded text-xs font-bold text-white flex items-center gap-1">
                        PENDING REVIEW
                      </div>
                    </div>
                  )}

                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-2 leading-tight">{post.title}</h3>
                    <div className="text-xs font-semibold text-amber-400 mb-2">{post.category}</div>
                    <p className="text-sm text-slate-300 mb-4 line-clamp-3 flex-1">{post.content}</p>
                    
                    <div className="flex gap-2 mt-4 pt-3 border-t border-amber-500/20">
                      <button 
                        onClick={() => handleReview(post.id, 'approve')}
                        className="flex-1 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/50 hover:border-emerald-500 text-emerald-400 hover:text-white font-bold py-2 rounded transition flex items-center justify-center gap-2 text-sm"
                      >
                        <CheckCircle className="w-4 h-4" /> Accept
                      </button>
                      <button 
                        onClick={() => handleReview(post.id, 'reject')}
                        className="flex-1 bg-red-600/20 hover:bg-red-600 border border-red-500/50 hover:border-red-500 text-red-400 hover:text-white font-bold py-2 rounded transition flex items-center justify-center gap-2 text-sm"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- Public Feed Section --- */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Published Alerts</h2>
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="glass-panel p-12 text-center text-slate-400">
            No active community alerts at this time.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => (
              <div key={post.id} className="glass-panel overflow-hidden hover:-translate-y-1 transition duration-300 flex flex-col border border-white/5 hover:border-cyan-500/30 shadow-lg relative group">
                
                {isOfficerOrAdmin && (
                  <button 
                    onClick={() => handleDelete(post.id)}
                    className="absolute top-3 right-3 z-10 p-2 bg-black/60 hover:bg-red-600/80 text-white rounded backdrop-blur opacity-0 group-hover:opacity-100 transition border border-white/10"
                    title="Delete Post"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {post.image_url ? (
                  <div className="h-48 w-full bg-[#111827] relative overflow-hidden group-hover:opacity-90">
                    <img src={`http://127.0.0.1:8001${post.image_url}`} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500 opacity-80" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur border border-white/10 px-2 py-1 rounded text-xs font-bold text-white flex items-center gap-1">
                      {getCategoryIcon(post.category)} {post.category}
                    </div>
                  </div>
                ) : (
                  <div className="h-24 w-full bg-gradient-to-tr from-slate-900 to-slate-800 relative flex items-center p-4">
                    <div className="bg-black/60 backdrop-blur border border-white/10 px-2 py-1 rounded text-xs font-bold text-white flex items-center gap-1">
                      {getCategoryIcon(post.category)} {post.category}
                    </div>
                  </div>
                )}

                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-white mb-2 leading-tight">{post.title}</h3>
                  <p className="text-sm text-slate-300 mb-4 line-clamp-3 flex-1">{post.content}</p>
                  
                  <div className="border-t border-white/10 pt-3 flex flex-col gap-1 text-xs text-slate-400">
                    {post.contact_info && (
                      <div><span className="font-semibold text-slate-300">Contact:</span> {post.contact_info}</div>
                    )}
                    <div><span className="font-semibold text-slate-300">Posted:</span> {new Date(post.created_at).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default CommunityBoard;
