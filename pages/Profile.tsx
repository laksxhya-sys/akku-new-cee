import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { GeneratedImage, UserRole } from '../types';
import { Image as ImageIcon, Calendar, Download, Sparkles, LogOut, Settings, User as UserIcon, Shield, Instagram, Phone, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role === UserRole.GUEST) {
      setLoading(false);
      return;
    }

    const fetchImages = async () => {
      try {
        const snapshot = await db.collection('generated_images')
            .where('userEmail', '==', user.email)
            .get();

        const fetchedImages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as GeneratedImage[];

        fetchedImages.sort((a, b) => b.timestamp - a.timestamp);

        setImages(fetchedImages);
      } catch (error) {
        console.error("Error fetching images:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [user]);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="max-w-7xl mx-auto px-6 pb-24">
      {/* Profile Header */}
      <div className="glass rounded-3xl p-8 mb-8 flex flex-col md:flex-row items-center gap-8 border border-white/5 bg-black/40">
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-white to-slate-500 p-1 shadow-2xl">
           <div className="w-full h-full rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-3xl font-bold text-white uppercase font-display">
              {user.name.charAt(0)}
           </div>
        </div>
        <div className="text-center md:text-left flex-1">
           <h1 className="text-3xl font-bold text-white mb-2 uppercase tracking-wide">{user.name}</h1>
           <p className="text-slate-400 flex items-center justify-center md:justify-start gap-2">
             <span className={`w-2 h-2 rounded-full ${user.role === UserRole.ADMIN ? 'bg-red-500' : 'bg-green-500'}`}></span>
             {user.email}
           </p>
           {user.role === UserRole.GUEST && (
             <div className="mt-4 px-4 py-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-lg inline-block text-sm">
                Guest Mode: Images are not saved to the cloud.
             </div>
           )}
        </div>
        <div className="flex gap-8 text-center">
            <div>
               <p className="text-3xl font-bold text-white">{images.length}</p>
               <p className="text-xs uppercase tracking-widest text-slate-500 mt-1">Creations</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Gallery Area */}
          <div className="lg:col-span-2 space-y-8">
              <div className="flex items-center gap-4">
                 <div className="p-2 bg-white/5 rounded-lg"><ImageIcon size={20} className="text-white" /></div>
                 <h2 className="text-xl font-bold text-white uppercase tracking-wide">Your Creations</h2>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {[1,2,3].map(i => <div key={i} className="aspect-square bg-white/5 rounded-2xl animate-pulse"></div>)}
                </div>
              ) : images.length === 0 ? (
                <div className="text-center py-20 bg-black/40 rounded-3xl border border-white/5 border-dashed backdrop-blur-md">
                   <Sparkles size={48} className="mx-auto text-slate-600 mb-4" />
                   <p className="text-slate-400">No images generated yet.</p>
                   <p className="text-sm text-slate-600 mt-1">Go to Chat or Templates to start creating!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {images.map(img => (
                    <div key={img.id} className="group relative bg-black/40 backdrop-blur-md rounded-2xl overflow-hidden border border-white/5 hover:border-white/20 transition-all">
                       <div className="aspect-square bg-black/50 relative overflow-hidden">
                          <img src={img.imageUrl} alt={img.prompt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                              <a href={img.imageUrl} download={`ceeplex-${img.id}.png`} className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform"><Download size={20} /></a>
                          </div>
                       </div>
                       <div className="p-4">
                          <p className="text-sm text-slate-300 line-clamp-2 mb-3 h-10">{img.prompt}</p>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                             <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(img.timestamp).toLocaleDateString()}</span>
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* Settings & Info Sidebar */}
          <div className="space-y-6">
              
              {/* Account Settings */}
              <div className="bg-black/60 backdrop-blur-md border border-white/5 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                      <Settings size={20} className="text-slate-400" />
                      <h3 className="font-bold text-white uppercase tracking-wide">Settings</h3>
                  </div>
                  
                  <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                          <div className="flex items-center gap-3">
                              <UserIcon size={18} className="text-slate-400" />
                              <div className="text-sm">
                                  <p className="text-slate-200">Account Type</p>
                                  <p className="text-xs text-slate-500 font-mono">{user.role}</p>
                              </div>
                          </div>
                          {user.role === UserRole.ADMIN && <Shield size={16} className="text-white" />}
                      </div>

                      <button onClick={handleLogout} className="w-full py-3 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-colors flex items-center justify-center gap-2 font-medium text-sm border border-red-500/20">
                          <LogOut size={18} /> Sign Out
                      </button>
                  </div>
              </div>

              {/* App Info / Creator Info */}
              <div className="bg-black/40 border border-white/5 rounded-2xl p-6 text-center backdrop-blur-md">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">Trainer & Creator</p>
                  <div className="w-20 h-20 mx-auto mb-3 flex items-center justify-center">
                      <img src="https://iili.io/fpcnLLQ.png" className="w-16 h-16 object-contain drop-shadow-md" alt="Logo"/>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1 tracking-wide">Lakshya Baradiya</h3>
                  <p className="text-xs text-slate-500 mb-4 uppercase tracking-wider">Lead Developer & AI Trainer</p>
                  
                  <div className="space-y-2 text-sm text-slate-400">
                      <a href="https://instagram.com/__laksxhya__" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 hover:text-white transition-colors p-2 bg-white/5 rounded-lg border border-white/5">
                          <Instagram size={16} /> @__laksxhya__
                      </a>
                      <a href="https://instagram.com/ceeplex" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 hover:text-white transition-colors p-2 bg-white/5 rounded-lg border border-white/5">
                          <Instagram size={16} /> @ceeplex
                      </a>
                      <div className="flex items-center justify-center gap-2 p-2 bg-white/5 rounded-lg border border-white/5">
                          <Phone size={16} /> +91 626871641
                      </div>
                       <div className="flex items-center justify-center gap-2 p-2 bg-white/5 rounded-lg border border-white/5 text-xs">
                          <Mail size={16} /> ceeplex1@gmail.com
                      </div>
                  </div>
              </div>

          </div>
      </div>
    </div>
  );
};