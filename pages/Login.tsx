import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, User as UserIcon } from 'lucide-react';
import firebase, { auth, db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { loginAsGuest } = useAuth();

  const getErrorMessage = (err: any) => {
    console.error("Auth Error Detail:", err);
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
      return "Invalid email or password.";
    }
    if (err.code === 'auth/email-already-in-use') return "Email already in use. Please sign in instead.";
    if (err.code === 'auth/weak-password') return "Password should be at least 6 characters.";
    if (err.code === 'auth/operation-not-allowed') return "Login provider not enabled in Firebase Console.";
    if (err.code === 'auth/unauthorized-domain') return "Domain not authorized. Add it in Firebase Console > Auth > Settings.";
    if (err.code === 'auth/popup-closed-by-user') return "Sign-in cancelled.";
    if (err.code === 'auth/popup-blocked') return "Popup blocked. Please allow popups for this site.";
    return err.message || "Authentication failed.";
  };

  const syncUserToFirestore = async (userCred: firebase.auth.UserCredential) => {
    if (!userCred.user?.email) return;
    const userRef = db.collection('users').doc(userCred.user.uid);
    try {
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            await userRef.set({
                email: userCred.user.email,
                name: userCred.user.displayName || userCred.user.email.split('@')[0],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                role: 'USER'
            });
        }
    } catch (e) {
        console.warn("Failed to sync user to firestore (permission issue possibly):", e);
    }
  };

  const checkAdminRedirect = (userEmail: string | null) => {
    if (userEmail && userEmail.toLowerCase() === 'ceeplex1@gmail.com') {
        navigate('/admin');
    } else {
        navigate('/');
    }
  };

  const handleAuthError = (err: any) => {
    if (err.code === 'auth/unauthorized-domain' || err.code === 'auth/operation-not-allowed') {
       setError("Domain not authorized by backend. Switching to Guest Mode...");
       setTimeout(() => {
           loginAsGuest();
           navigate('/');
       }, 2000);
    } else {
       setError(getErrorMessage(err));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let userCred;
      if (isLogin) {
        userCred = await auth.signInWithEmailAndPassword(email, password);
      } else {
        userCred = await auth.createUserWithEmailAndPassword(email, password);
      }
      await syncUserToFirestore(userCred);
      checkAdminRedirect(userCred.user?.email || null);
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const userCred = await auth.signInWithPopup(provider);
      await syncUserToFirestore(userCred);
      checkAdminRedirect(userCred.user?.email || null);
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    loginAsGuest();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
         <div className="blob w-[500px] h-[500px] bg-brand-500/20 top-[-10%] left-[-10%]"></div>
         <div className="blob w-[400px] h-[400px] bg-purple-500/20 bottom-[10%] right-[10%]"></div>
      </div>

      <div className="w-full max-w-md bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden z-10">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-400 to-purple-500" />
        
        <div className="text-center mb-8">
           <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
             <img src="https://iili.io/fpcnLLQ.png" alt="Ceeplex" className="w-16 h-16 object-contain drop-shadow-xl" />
           </div>
           <h1 className="text-3xl font-bold text-white mb-2">
             {isLogin ? 'Welcome Back' : 'Create Account'}
           </h1>
           <p className="text-slate-400 text-sm">
             {isLogin ? 'Enter your details to access your workspace' : 'Start your creative journey with Ceeplex'}
           </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex flex-col gap-2 text-red-400 text-sm animate-pulse">
             <div className="flex items-start gap-3">
               <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
               <span>{error}</span>
             </div>
             <button onClick={handleGuestLogin} className="mt-2 text-xs font-bold text-white bg-red-500/20 hover:bg-red-500/30 py-2 px-3 rounded-lg transition-colors w-full text-left flex items-center gap-2">
                <UserIcon size={14} /> Continue as Guest (Offline Mode)
             </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-2 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors placeholder:text-slate-600" placeholder="name@company.com" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-2 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors placeholder:text-slate-600" placeholder="••••••••" minLength={6} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-brand-500/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2">
            {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <>{isLogin ? 'Sign In' : 'Create Account'}</>}
          </button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px bg-white/10 flex-1" />
          <span className="text-xs text-slate-500 font-medium uppercase">Or continue with</span>
          <div className="h-px bg-white/10 flex-1" />
        </div>

        <div className="space-y-3">
            <button type="button" onClick={handleGoogleLogin} disabled={loading} className="w-full bg-white text-black font-bold py-3.5 rounded-xl transition-all hover:bg-slate-200 flex items-center justify-center gap-3 disabled:opacity-50">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26+-.19-.58z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google
            </button>
            <button type="button" onClick={handleGuestLogin} className="w-full bg-white/5 text-slate-300 font-bold py-3.5 rounded-xl transition-all hover:bg-white/10 flex items-center justify-center gap-3">
              <UserIcon size={18} /> Guest Access (Demo Mode)
            </button>
        </div>
        
        <div className="mt-8 text-center">
            <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-sm text-slate-400 hover:text-white transition-colors">
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
        </div>
      </div>
    </div>
  );
};