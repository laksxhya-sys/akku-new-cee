import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, MessageSquare, LayoutTemplate, LogOut, Shield, User as UserIcon } from 'lucide-react';

export const Layout = ({ children }: { children?: React.ReactNode }) => {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen font-sans selection:bg-white/30 text-slate-100">
      
      {/* DESKTOP: Top Navigation Bar */}
      <nav className="hidden md:flex fixed top-6 left-0 right-0 z-50 justify-center px-4">
        <div className="glass-pill w-full max-w-5xl rounded-[2rem] p-2 pl-6 pr-2 flex items-center justify-between shadow-2xl shadow-black/40 border border-white/10">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img src="https://iili.io/fpcnLLQ.png" alt="Ceeplex" className="w-8 h-8 object-contain group-hover:scale-110 transition-transform" />
            <span className="font-display font-bold tracking-widest text-lg uppercase text-white group-hover:text-slate-200 transition-colors">Ceeplex</span>
          </Link>

          {/* Desktop Links */}
          <div className="flex items-center bg-black/40 backdrop-blur-md rounded-full p-1 border border-white/5">
             <NavLink to="/" icon={<Home size={16} />} label="Home" active={isActive('/')} />
             <NavLink to="/chat" icon={<MessageSquare size={16} />} label="Chat" active={isActive('/chat')} />
             <NavLink to="/templates" icon={<LayoutTemplate size={16} />} label="Templates" active={isActive('/templates')} />
             {isAdmin && <NavLink to="/admin" icon={<Shield size={16} />} label="Admin" active={isActive('/admin')} />}
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-2">
             {user ? (
               <div className="flex items-center gap-2 pl-2 pr-2 py-1 rounded-full bg-black/40 border border-white/5 transition-colors">
                  <Link 
                    to="/profile"
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isActive('/profile') ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white'}`}
                    title="Your Profile & Creations"
                  >
                    <UserIcon size={16} />
                  </Link>

                  <button 
                    onClick={handleLogout}
                    className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition-all border border-white/5"
                    title="Logout"
                  >
                     <LogOut size={16} />
                  </button>
               </div>
             ) : (
                <Link to="/login" className="px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm font-bold transition-all border border-white/5">
                  Login
                </Link>
             )}
          </div>
        </div>
      </nav>

      {/* MOBILE: Bottom Navigation Bar (Refined Design) */}
      <nav className="md:hidden fixed bottom-6 left-4 right-4 z-[100] flex justify-center">
        <div className="glass-pill rounded-[2rem] p-2 flex items-center gap-1 shadow-2xl bg-black/80 backdrop-blur-2xl border border-white/10 w-full max-w-[380px] justify-between">
          
          <MobileNavItem 
            to="/" 
            icon={<Home size={22} />} 
            label="Home"
            active={isActive('/')} 
          />
          
          <MobileNavItem 
            to="/chat" 
            icon={<MessageSquare size={22} />} 
            label="Chat"
            active={isActive('/chat')} 
          />
          
          <MobileNavItem 
            to="/templates" 
            icon={<LayoutTemplate size={22} />} 
            label="Templates"
            active={isActive('/templates')} 
          />
          
          {isAdmin ? (
             <MobileNavItem 
                to="/admin" 
                icon={<Shield size={22} />} 
                label="Admin"
                active={isActive('/admin')} 
             />
          ) : (
             <MobileNavItem 
                to="/profile" 
                icon={<UserIcon size={22} />} 
                label="Profile"
                active={isActive('/profile')} 
             />
          )}
          
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-4 pb-28 md:pt-32 md:pb-0 min-h-screen relative z-10">
        {children}
      </main>
    </div>
  );
};

const NavLink = ({ to, icon, label, active }: { to: string, icon: React.ReactNode, label: string, active: boolean }) => (
  <Link 
    to={to} 
    className={`
      flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300
      ${active 
        ? 'bg-white/20 text-white shadow-lg shadow-white/5 backdrop-blur-md' 
        : 'text-slate-400 hover:text-white hover:bg-white/5'}
    `}
  >
    {label}
  </Link>
);

const MobileNavItem = ({ to, icon, label, active }: { to: string, icon: React.ReactNode, label: string, active: boolean }) => (
  <Link 
    to={to} 
    className={`
      relative flex items-center justify-center rounded-[1.5rem] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden
      ${active 
        ? 'bg-white text-black px-5 py-3 shadow-[0_0_20px_rgba(255,255,255,0.3)] flex-[2]' 
        : 'text-slate-400 hover:text-white px-3 py-3 flex-1 bg-transparent hover:bg-white/5'
      }
    `}
  >
    <div className="flex items-center justify-center whitespace-nowrap gap-2">
        {icon}
        {active && (
            <span className="text-sm font-bold animate-fade-in whitespace-nowrap font-display uppercase tracking-wider">
                {label}
            </span>
        )}
    </div>
  </Link>
);