import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => void;
  loginAsGuest: () => void;
  isAdmin: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children?: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Heartbeat: Update lastActive every minute to track "Live Users"
  useEffect(() => {
    if (!user || user.role === UserRole.GUEST) return;

    const updateHeartbeat = async () => {
      try {
        const userRef = doc(db, 'users', auth.currentUser?.uid || 'unknown');
        // We use Date.now() for easier client-side comparison in Admin panel
        await updateDoc(userRef, { lastActive: Date.now() });
      } catch (e) {
        // Silent fail (might be permission issue or guest)
      }
    };

    updateHeartbeat(); // Immediate
    const interval = setInterval(updateHeartbeat, 60000); // Every 1 min

    return () => clearInterval(interval);
  }, [user?.email]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        let role = UserRole.USER;
        // Hardcoded Admin Email for security
        if (firebaseUser.email.toLowerCase() === 'ceeplex1@gmail.com') {
          role = UserRole.ADMIN;
        }

        const userData = {
          email: firebaseUser.email,
          name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
          role
        };
        setUser(userData);

        // Sync basic info on login
        try {
            await setDoc(doc(db, 'users', firebaseUser.uid), {
                email: userData.email,
                name: userData.name,
                role: userData.role,
                lastActive: Date.now()
            }, { merge: true });
        } catch(e) { console.error("Sync error", e); }

      } else {
        setUser(prev => prev?.email === 'guest@ceeplex.dev' ? prev : null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      if (user?.email === 'guest@ceeplex.dev') {
        setUser(null);
      } else {
        await firebaseSignOut(auth);
      }
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const loginAsGuest = () => {
    setUser({
      email: 'guest@ceeplex.dev',
      name: 'Guest Developer',
      role: UserRole.GUEST
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      logout,
      loginAsGuest,
      isAdmin: user?.role === UserRole.ADMIN,
      isAuthenticated: !!user
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};