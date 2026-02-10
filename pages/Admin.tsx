import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Users, Image as ImageIcon, Plus, Trash2, RefreshCw, AlertTriangle, Activity, Link as LinkIcon, Edit2, X } from 'lucide-react';
import { db } from '../services/firebase';
import { Template, SystemLog, User } from '../types';

export const Admin = () => {
  const { isAdmin, user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);

  // Data States
  const [stats, setStats] = useState({ totalUsers: 0, liveUsers: 0, totalChats: 0, totalImages: 0, errorsToday: 0 });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [allChats, setAllChats] = useState<any[]>([]);

  // Template Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
      title: '', description: '', category: '', imageUrl: '', promptTemplate: ''
  });

  if (!isAdmin) return <Navigate to="/" />;

  const refreshData = async () => {
      setLoading(true);
      try {
          // 1. Fetch Users & Calculate Live (Active < 5 mins ago)
          const usersSnap = await db.collection('users').get();
          const users = usersSnap.docs.map(d => d.data() as User);
          const now = Date.now();
          const live = users.filter(u => u.lastActive && (now - u.lastActive) < 300000).length; // 5 mins

          // 2. Fetch Chats
          const chatsSnap = await db.collection('chats').get();
          const chats = chatsSnap.docs.map(d => ({id: d.id, ...d.data()}));

          // 3. Fetch Images
          const imagesSnap = await db.collection('generated_images').get();

          // 4. Fetch Logs (Errors)
          const logsSnap = await db.collection('system_logs').orderBy('timestamp', 'desc').limit(100).get();
          const fetchedLogs = logsSnap.docs.map(d => ({id: d.id, ...d.data()})) as SystemLog[];
          
          // Calculate errors today
          const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
          const errorsToday = fetchedLogs.filter(l => l.type === 'ERROR' && l.timestamp > startOfDay.getTime()).length;

          // 5. Fetch Templates
          const tplSnap = await db.collection('templates').get();
          const tpls = tplSnap.docs.map(d => ({id: d.id, ...d.data()})) as Template[];

          setStats({
              totalUsers: users.length,
              liveUsers: live,
              totalChats: chats.length,
              totalImages: imagesSnap.size,
              errorsToday
          });
          setLogs(fetchedLogs);
          setTemplates(tpls);
          setAllChats(chats);

      } catch (e) { console.error(e); }
      finally { setLoading(false); }
  };

  useEffect(() => { refreshData(); }, []);

  const handleTemplateSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          if (editingId) {
              // Update existing
              await db.collection('templates').doc(editingId).update({
                  ...templateForm
              });
              alert("Template Updated Successfully!");
          } else {
              // Create new
              await db.collection('templates').add({
                  ...templateForm,
                  likes: 0,
                  createdAt: Date.now()
              });
              alert("Template Created Successfully!");
          }
          
          setTemplateForm({ title: '', description: '', category: '', imageUrl: '', promptTemplate: '' });
          setEditingId(null);
          refreshData();
      } catch(e) { 
          alert("Error saving template"); 
          console.error(e);
      }
  };

  const handleEditTemplate = (t: Template) => {
      setTemplateForm({
          title: t.title,
          description: t.description,
          category: t.category,
          imageUrl: t.imageUrl,
          promptTemplate: t.promptTemplate
      });
      setEditingId(t.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTemplate = async (id: string) => {
      if(!window.confirm("Are you sure you want to delete this template? This action cannot be undone.")) return;
      try {
        await db.collection('templates').doc(id).delete();
        if (editingId === id) {
            setEditingId(null);
            setTemplateForm({ title: '', description: '', category: '', imageUrl: '', promptTemplate: '' });
        }
        refreshData();
      } catch (e) {
        alert("Failed to delete template.");
      }
  };

  const cancelEdit = () => {
      setEditingId(null);
      setTemplateForm({ title: '', description: '', category: '', imageUrl: '', promptTemplate: '' });
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">Admin Console <span className="text-xs bg-brand-500 text-black px-2 py-1 rounded font-bold">SUPERUSER</span></h1>
          <p className="text-slate-400 text-sm mt-1">Logged in as {user?.email}</p>
        </div>
        <button onClick={refreshData} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><RefreshCw size={20} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
          {['dashboard', 'templates', 'chats', 'logs'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-bold capitalize whitespace-nowrap ${activeTab === tab ? 'bg-white text-black' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
                  {tab}
              </button>
          ))}
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard icon={<Activity className="text-green-400" />} title="Live Users (5m)" value={stats.liveUsers.toString()} />
                <StatCard icon={<Users className="text-blue-400" />} title="Total Users" value={stats.totalUsers.toString()} />
                <StatCard icon={<ImageIcon className="text-purple-400" />} title="Images Generated" value={stats.totalImages.toString()} />
                <StatCard icon={<AlertTriangle className="text-red-400" />} title="Errors Today" value={stats.errorsToday.toString()} />
            </div>
            
            {/* Recent Logs Preview */}
            <div className="bg-dark-surface border border-white/5 rounded-2xl p-6">
                <h3 className="font-bold mb-4">Recent System Events</h3>
                <div className="space-y-2">
                    {logs.slice(0,5).map(log => (
                        <div key={log.id} className="text-xs flex gap-4 p-2 bg-black/20 rounded">
                            <span className={log.type === 'ERROR' ? 'text-red-400' : 'text-blue-400'}>{log.type}</span>
                            <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}]</span>
                            <span className="text-slate-300 truncate flex-1">{log.message}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create/Edit Form */}
            <div className="bg-dark-surface border border-white/5 p-6 rounded-2xl h-fit">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold flex items-center gap-2">
                        {editingId ? <><Edit2 size={16}/> Edit Template</> : <><Plus size={16}/> Create Template</>}
                    </h3>
                    {editingId && (
                        <button onClick={cancelEdit} className="text-xs text-red-400 hover:text-white flex items-center gap-1">
                            <X size={12} /> Cancel
                        </button>
                    )}
                </div>
                
                <form onSubmit={handleTemplateSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">Title</label>
                        <input required placeholder="e.g. Cyberpunk Avatar" className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm focus:border-cyan-500 focus:outline-none" value={templateForm.title} onChange={e=>setTemplateForm({...templateForm, title: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">Category</label>
                        <input required placeholder="e.g. Social Media" className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm focus:border-cyan-500 focus:outline-none" value={templateForm.category} onChange={e=>setTemplateForm({...templateForm, category: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><LinkIcon size={10} /> Image URL (Direct Link)</label>
                        <input required type="url" placeholder="https://example.com/image.jpg" className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm focus:border-cyan-500 focus:outline-none" value={templateForm.imageUrl} onChange={e=>setTemplateForm({...templateForm, imageUrl: e.target.value})} />
                        {templateForm.imageUrl && (
                            <div className="mt-2 h-20 w-full bg-black/40 rounded-lg overflow-hidden flex items-center justify-center border border-white/5">
                                <img src={templateForm.imageUrl} alt="Preview" className="h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')}/>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">Description</label>
                        <textarea required placeholder="Short description for the user..." className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm focus:border-cyan-500 focus:outline-none" value={templateForm.description} onChange={e=>setTemplateForm({...templateForm, description: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">AI Prompt Template</label>
                        <textarea required placeholder="Prompt sent to Gemini. Use 'this image' to refer to user upload." className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm h-24 focus:border-cyan-500 focus:outline-none" value={templateForm.promptTemplate} onChange={e=>setTemplateForm({...templateForm, promptTemplate: e.target.value})} />
                    </div>
                    <button type="submit" className={`w-full py-3 rounded-lg font-bold text-sm transition-colors ${editingId ? 'bg-purple-600 hover:bg-purple-500' : 'bg-brand-600 hover:bg-brand-500'}`}>
                        {editingId ? 'Update Template' : 'Create Template'}
                    </button>
                </form>
            </div>

            {/* List */}
            <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold mb-2">Existing Templates ({templates.length})</h3>
                {templates.map(t => (
                    <div key={t.id} className={`flex gap-4 items-center bg-dark-surface border p-4 rounded-xl transition-colors ${editingId === t.id ? 'border-purple-500 bg-purple-500/10' : 'border-white/5 hover:border-white/10'}`}>
                        <img src={t.imageUrl} className="w-20 h-20 rounded-lg object-cover bg-black/30" alt={t.title} />
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-white truncate">{t.title}</h4>
                            <p className="text-xs text-brand-400 mb-1">{t.category}</p>
                            <p className="text-xs text-slate-500 truncate">{t.description}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <button 
                              onClick={() => handleEditTemplate(t)} 
                              className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-colors flex items-center gap-2 justify-center"
                            >
                              <Edit2 size={16}/>
                            </button>
                            <button 
                              onClick={() => handleDeleteTemplate(t.id)} 
                              className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors flex items-center gap-2 justify-center"
                            >
                              <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {activeTab === 'chats' && (
          <div className="space-y-4">
              <h3 className="font-bold mb-4">All User Chats ({allChats.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allChats.map(chat => (
                      <div key={chat.id} className="bg-dark-surface border border-white/5 p-4 rounded-xl">
                          <p className="text-xs text-brand-400 mb-1">{chat.userEmail || 'Guest'}</p>
                          <h4 className="font-bold text-sm truncate">{chat.title}</h4>
                          <p className="text-xs text-slate-500 mt-2">ID: {chat.id}</p>
                          <p className="text-xs text-slate-500">Updated: {new Date(chat.updatedAt?.seconds * 1000 || Date.now()).toLocaleDateString()}</p>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'logs' && (
          <div className="bg-black/40 rounded-xl p-4 font-mono text-xs overflow-y-auto max-h-[600px] space-y-2">
              {logs.map(log => (
                  <div key={log.id} className="border-b border-white/5 pb-2">
                      <div className="flex gap-2 text-slate-500 mb-1">
                          <span>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                          <span className={log.type==='ERROR'?'text-red-500':'text-blue-500'}>{log.type}</span>
                      </div>
                      <div className="text-slate-300 break-words">{log.message}</div>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, title, value }: { icon: React.ReactNode, title: string, value: string }) => (
  <div className="bg-dark-surface border border-white/5 p-6 rounded-2xl flex items-center gap-4">
    <div className="p-3 bg-white/5 rounded-xl">{icon}</div>
    <div>
      <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  </div>
);