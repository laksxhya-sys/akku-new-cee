import React, { useState, useEffect } from 'react';
import { Search, Heart, Sparkles, X, Download, Share2, Bell, Instagram } from 'lucide-react';
import { generateImageFromTemplate } from '../services/geminiService';
import { compressImage } from '../services/imageUtils';
import { Template } from '../types';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

const CategoryPill: React.FC<{ label: string, active: boolean, onClick: () => void }> = ({ label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
      active 
        ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]' 
        : 'bg-black/30 backdrop-blur-md text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
    }`}
  >
    {label}
  </button>
);

export const Templates = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [userImage, setUserImage] = useState<{file: File, preview: string} | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch Templates from Real DB (v8 Syntax)
  useEffect(() => {
    const unsubscribe = db.collection('templates')
        .onSnapshot((snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Template));
            fetched.sort((a,b) => b.likes - a.likes); // Default sort
            setTemplates(fetched);
            setIsLoading(false);
        });
    return () => unsubscribe();
  }, []);

  const categories = ['All', 'Social Media', 'Marketing', 'Creative', 'Business', 'Personal'];

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleTemplateClick = (template: Template) => {
    setSelectedTemplate(template);
    setUserImage(null);
    setGeneratedImage(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setUserImage({ file, preview: ev.target.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplate || !userImage) return;

    setIsGenerating(true);
    try {
      const base64 = userImage.preview.split(',')[1];
      const result = await generateImageFromTemplate(selectedTemplate.promptTemplate, base64, userImage.file.type);
      setGeneratedImage(result);

      if (user && result && !result.includes("Error")) {
          try {
              // Compress before saving to DB if large
              let imageToSave = result;
              if (result.length > 500000) {
                  imageToSave = await compressImage(result);
              }

              await db.collection('generated_images').add({
                  userEmail: user.email,
                  prompt: `Template: ${selectedTemplate.title}`,
                  imageUrl: imageToSave,
                  timestamp: Date.now()
              });
          } catch(e) {
              console.error("Failed to save template image to profile", e);
          }
      }

    } catch (error) {
      console.error(error);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const closeModal = () => {
    setSelectedTemplate(null);
    setUserImage(null);
    setGeneratedImage(null);
  };

  const handleShare = async () => {
    if (!generatedImage) return;
    try {
      const blob = await (await fetch(generatedImage)).blob();
      const file = new File([blob], `ceeplex-${selectedTemplate?.id}.png`, { type: blob.type });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Created with Ceeplex',
          text: 'Check out this image I created with Ceeplex AI!'
        });
      } else {
        alert("Sharing not supported on this device. Image downloaded instead.");
        // Fallback to download link trigger
        const link = document.createElement('a');
        link.href = generatedImage;
        link.download = `ceeplex-${selectedTemplate?.id}.png`;
        link.click();
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <div className="min-h-screen bg-transparent pb-20 relative">
      
      {/* Background Blur Overlay for Templates Only */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-2xl z-[-1]" />

      {/* Header Area */}
      <div className="pt-6 px-6 pb-4 bg-transparent sticky top-0 z-30">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-md font-display uppercase">Templates</h1>
          <button className="p-2 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md transition-colors relative border border-white/10">
            <Bell size={20} className="text-slate-300" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-black/50"></span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search AI templates..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all shadow-inner"
          />
        </div>

        {/* Categories */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(cat => (
            <CategoryPill 
              key={cat} 
              label={cat} 
              active={selectedCategory === cat} 
              onClick={() => setSelectedCategory(cat)} 
            />
          ))}
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="px-6 py-4">
        {isLoading && <div className="text-center text-slate-400 py-20">Loading amazing templates...</div>}

        {!isLoading && filteredTemplates.length === 0 && (
           <div className="text-center text-slate-400 py-20 border border-white/5 rounded-3xl border-dashed bg-black/40 backdrop-blur-md">
              <Sparkles size={32} className="mx-auto mb-3 opacity-50"/>
              <p>No templates found.</p>
           </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTemplates.map((template, index) => {
            // Alternate badges for visual variety
            const isTrending = index % 3 === 0;
            const isPopular = index % 3 === 1;

            return (
              <div 
                key={template.id} 
                onClick={() => handleTemplateClick(template)}
                className="group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer shadow-2xl hover:scale-[1.02] transition-transform duration-300 border border-white/10 bg-black/40"
              >
                {/* Background Image */}
                <img 
                  src={template.imageUrl} 
                  alt={template.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-90" />
                
                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {isTrending && (
                        <span className="px-2 py-1 bg-white/10 backdrop-blur-md rounded-md text-[10px] font-bold text-white uppercase tracking-wider shadow-lg border border-white/10">
                            Trending
                        </span>
                    )}
                    {isPopular && (
                        <span className="px-2 py-1 bg-white/10 backdrop-blur-md rounded-md text-[10px] font-bold text-white uppercase tracking-wider shadow-lg border border-white/10">
                            Popular
                        </span>
                    )}
                </div>

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-white font-bold text-sm md:text-base leading-tight mb-1 line-clamp-2 drop-shadow-md uppercase tracking-wide">{template.title}</h3>
                  <p className="text-slate-300 text-xs drop-shadow-sm">{template.category}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in">
          {/* Modal Container */}
          <div className="bg-black/60 backdrop-blur-2xl border border-white/10 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-auto md:max-h-[90vh] animate-slide-up">
            
            {/* Left: Preview */}
            <div className="shrink-0 md:flex-1 bg-black/50 relative flex items-center justify-center p-6 h-[35%] md:h-auto min-h-[200px] border-b md:border-b-0 md:border-r border-white/10">
              {generatedImage ? (
                <img src={generatedImage} alt="Generated" className="w-full h-full object-contain rounded-xl shadow-2xl" />
              ) : userImage ? (
                <img src={userImage.preview} alt="Upload" className="w-full h-full object-contain rounded-xl shadow-xl opacity-80" />
              ) : (
                <div className="text-center text-slate-500 flex flex-col items-center">
                   <img src={selectedTemplate.imageUrl} className="w-24 h-24 md:w-32 md:h-32 rounded-2xl object-cover mb-4 opacity-50 grayscale" />
                   <p className="text-xs md:text-sm uppercase tracking-wider">Preview</p>
                </div>
              )}
            </div>

            {/* Right: Controls */}
            <div className="flex-1 flex flex-col min-h-0 bg-transparent w-full md:w-96">
              
              {/* Header */}
              <div className="p-6 pb-2 shrink-0 flex justify-between items-start">
                 <div>
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Selected Template</span>
                   <h2 className="text-xl font-bold text-white uppercase tracking-wide">{selectedTemplate.title}</h2>
                 </div>
                 <button onClick={closeModal} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-white transition-colors"><X size={20} /></button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-4 space-y-6">
                <p className="text-slate-300 text-sm leading-relaxed">{selectedTemplate.description}</p>
                
                {!generatedImage && (
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-white block uppercase tracking-wide text-xs">Upload Source Image</label>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-2xl hover:border-white/40 hover:bg-white/5 cursor-pointer transition-all group bg-black/20">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="p-3 bg-white/5 rounded-full mb-2 group-hover:scale-110 transition-transform">
                             <Sparkles size={20} className="text-white" />
                        </div>
                        <p className="text-xs text-slate-400 group-hover:text-white transition-colors">Click to upload photo</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  </div>
                )}
                
                {generatedImage && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm text-center font-medium">
                        ✨ Image Generated Successfully!
                    </div>
                )}
              </div>

              {/* Footer Buttons */}
              <div className="p-6 pt-4 border-t border-white/5 shrink-0 space-y-3 bg-black/20">
                {generatedImage ? (
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={handleShare}
                          className="col-span-1 py-3 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors uppercase tracking-wide text-xs"
                        >
                          <Instagram size={16} /> Story / Share
                        </button>
                        <a 
                          href={generatedImage} 
                          download={`ceeplex-${selectedTemplate.id}.png`}
                          className="col-span-1 py-3 bg-white/10 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-white/20 transition-colors uppercase tracking-wide text-xs border border-white/10"
                        >
                          <Download size={16} /> Save
                        </a>
                        <button 
                            onClick={() => { setGeneratedImage(null); }}
                            className="col-span-2 py-3 bg-transparent text-slate-400 font-medium rounded-xl hover:text-white transition-colors uppercase tracking-wide text-xs"
                        >
                            Try Another Photo
                        </button>
                    </div>
                ) : (
                    <button 
                      onClick={handleGenerate}
                      disabled={!userImage || isGenerating}
                      className="w-full py-4 bg-white text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 uppercase tracking-wide text-sm"
                    >
                      {isGenerating ? 'Creating Magic...' : 'Generate Art'}
                      {!isGenerating && <Sparkles size={18} />}
                    </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};