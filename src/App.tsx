import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Loader2, LogOut, Wallet } from 'lucide-react';
import Dashboard from './components/Dashboard';
import { LoginWithSanscounts } from './components/LoginWithSanscounts';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCallback, setIsCallback] = useState(window.location.pathname === '/auth/callback');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle the callback route
  useEffect(() => {
    if (isCallback) {
      const timeout = setTimeout(() => {
        if (window.opener) {
          window.close();
        } else {
          window.location.href = '/';
        }
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isCallback]);

  const handleSanscountsLogin = async (userData: any) => {
    try {
      setLoading(true);
      // Sign in anonymously to get a Firebase UID for Firestore rules
      const userCredential = await signInAnonymously(auth);
      const currentUser = userCredential.user;
      
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      const email = userData?.email || 'sloudsan@gmail.com';
      
      if (!userSnap.exists()) {
        const initialBalance = email === 'sloudsan@gmail.com' ? 799779977997 : 1000;
        
        await setDoc(userRef, {
          uid: currentUser.uid,
          email: email,
          displayName: userData?.name || userData?.displayName || 'Sanscounts User',
          photoURL: userData?.picture || userData?.photoURL || 'https://i.postimg.cc/wvXS9k1D/IMG-9128.jpg',
          balance: initialBalance,
          createdAt: serverTimestamp()
        });
      } else {
        // Update existing user with latest Sanscounts data
        await setDoc(userRef, {
          email: email,
          displayName: userData?.name || userData?.displayName || 'Sanscounts User',
          photoURL: userData?.picture || userData?.photoURL || 'https://i.postimg.cc/wvXS9k1D/IMG-9128.jpg',
        }, { merge: true });
      }
    } catch (error: any) {
      console.error("Error signing in with Sanscounts", error);
      if (error.code === 'auth/operation-not-allowed') {
        alert("CRITICAL: Please enable 'Anonymous' provider in your Firebase Console > Authentication > Sign-in method.");
      } else {
        alert("Login failed: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  if (isCallback) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-gray-400">Authenticating with Sanscounts...</p>
        <p className="text-xs text-gray-600 mt-2">This window will close automatically.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-5xl font-bold tracking-tighter">Sans Sent</h1>
            <p className="text-gray-400">Real-time money transfer.</p>
          </div>
          <LoginWithSanscounts onLoginSuccess={handleSanscountsLogin} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 p-4 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <Wallet className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight">Sans Sent</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 py-8">
        <Dashboard user={user} />
      </main>
    </div>
  );
}
