import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Compass, MessageSquare, Image as ImageIcon, ArrowRight, Zap, Layers, Wand2, Instagram, Mail, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Home = () => {
  const { user } = useAuth();

  return (
    <div className="relative w-full flex flex-col items-center justify-center px-6 pb-24 md:pb-12">
      {/* Background Blobs - Monochrome */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="blob w-[600px] h-[600px] bg-white/5 top-[-20%] left-[20%]"></div>
        <div className="blob w-[500px] h-[500px] bg-slate-500/10 bottom-[0%] right-[-10%]"></div>
      </div>

      <div className="relative z-10 w-full max-w-6xl flex flex-col items-center">
        
        {/* Hero Card */}
        <div className="w-full glass rounded-3xl p-10 md:p-24 text-center relative overflow-hidden shadow-2xl shadow-black/60 mb-16 border border-white/10 bg-black/20">
          {/* Subtle overlay gradient */}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
          
          <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
            
            <img src="https://iili.io/fpcnLLQ.png" alt="Ceeplex Logo" className="w-24 h-24 object-contain mb-8 drop-shadow-[0_0_25px_rgba(255,255,255,0.2)]" />

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              <span className="text-xs font-bold tracking-[0.2em] uppercase text-slate-300 font-display">AI-Powered Creative Engine</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 tracking-tighter text-white leading-[1.1] font-display drop-shadow-xl">
              Welcome to <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">Ceeplex</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-300 mb-12 max-w-2xl mx-auto leading-relaxed font-light drop-shadow-md">
              Unleash your creativity with the next generation of AI tools. 
              Chat, design, and explore templates in a seamless interface.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link to="/chat" className="group relative px-8 py-4 bg-white text-black font-bold text-lg rounded-2xl overflow-hidden shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_-10px_rgba(255,255,255,0.5)] hover:scale-105 active:scale-95 transition-all duration-300 w-full sm:w-auto font-display tracking-wide">
                <div className="absolute inset-0 bg-slate-200 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <div className="relative flex items-center justify-center gap-2">
                  <Sparkles size={20} className="fill-current" />
                  START CHAT
                </div>
              </Link>
              
              <Link to="/templates" className="group px-8 py-4 glass-pill text-white font-bold text-lg rounded-2xl border border-white/10 hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-300 w-full sm:w-auto flex items-center justify-center gap-2 font-display tracking-wide">
                 <Compass size={20} />
                 TEMPLATES
              </Link>
            </div>
          </div>
        </div>

        {/* Tools & Details Section */}
        <div className="w-full mb-16">
          <div className="flex items-center gap-4 mb-8 px-4">
             <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent flex-1"></div>
             <span className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 shadow-black drop-shadow-md font-display">Powerful Tools</span>
             <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent flex-1"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <ToolCard 
                to="/chat"
                title="AI Chat Assistant"
                description="Engage in natural conversations, ask complex questions, or brainstorm ideas with our advanced language model."
                icon={<MessageSquare size={32} className="text-white" />}
                delay="0ms"
             />
             <ToolCard 
                to="/templates"
                title="Creative Templates"
                description="Transform your photos instantly using professionally curated styles. Cyberpunk, Watercolor, 3D, and more."
                icon={<Layers size={32} className="text-slate-300" />}
                delay="100ms"
             />
             <ToolCard 
                to="/chat" 
                title="Image Generation"
                description="Describe what you want to see and watch as AI brings your imagination to life in seconds."
                icon={<Wand2 size={32} className="text-slate-200" />}
                delay="200ms"
             />
          </div>
        </div>

        {/* Creator Info Footer */}
        <div className="w-full max-w-3xl mx-auto glass rounded-2xl p-8 border border-white/10 text-center bg-black/40">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2 font-display">Trainer & Creator</p>
            <h2 className="text-2xl font-bold text-white mb-6 font-display tracking-wide">Lakshya Baradiya</h2>
            
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-300">
                <a href="https://instagram.com/__laksxhya__" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                    <Instagram size={18} />
                    <span>@__laksxhya__</span>
                </a>
                <a href="https://instagram.com/ceeplex" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                    <Instagram size={18} />
                    <span>@ceeplex</span>
                </a>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-6 mt-4 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                    <Phone size={14} />
                    <span>+91 626871641</span>
                </div>
                <div className="flex items-center gap-2">
                    <Mail size={14} />
                    <a href="mailto:ceeplex1@gmail.com" className="hover:text-white transition-colors">ceeplex1@gmail.com</a>
                </div>
            </div>
            <div className="mt-6 pt-6 border-t border-white/5 text-[10px] text-slate-600">
                © {new Date().getFullYear()} Ceeplex AI. All rights reserved.
            </div>
        </div>

      </div>
    </div>
  );
};

const ToolCard = ({ to, title, description, icon, delay }: { to: string, title: string, description: string, icon: React.ReactNode, delay: string }) => (
  <Link 
    to={to} 
    className="group relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8 hover:bg-white/5 transition-all duration-300 hover:-translate-y-2 overflow-hidden shadow-lg"
    style={{ animationDelay: delay }}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    
    <div className="relative z-10">
      <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-white/5">
        {icon}
      </div>
      
      <h3 className="text-xl font-bold text-white mb-3 group-hover:text-slate-200 transition-colors font-display tracking-wide">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed mb-6">
        {description}
      </p>
      
      <div className="flex items-center text-sm font-bold text-white/40 group-hover:text-white transition-colors uppercase tracking-widest text-xs">
        Try Now <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  </Link>
);