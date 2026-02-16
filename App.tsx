
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ViewType, MediaType, MediaItem, User, AuthView } from './types';
import { 
  ImageIcon, VideoIcon, UploadIcon, SearchIcon, TrashIcon, 
  PlayIcon, PauseIcon, VolumeIcon, MuteIcon, ExpandIcon, FilterIcon,
  SunIcon, MoonIcon
} from './components/Icons';

type GroupingMode = 'none' | 'day' | 'month' | 'year';

// --- GLOBAL STYLES ---
const GLOBAL_STYLES = `
  .animate-in { animation: fadeIn 0.2s ease-out; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .zoom-in-95 { animation: zoomIn 0.2s ease-out; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-thumb { background: #e4e4e7; border-radius: 10px; }
  .dark ::-webkit-scrollbar-thumb { background: #3f3f46; }
  html, body { height: 100%; overflow: hidden; margin: 0; padding: 0; }
`;

// --- DATABASE SERVICE ---
const DB_NAME = 'LuminaGalleryDB';
const MEDIA_STORE = 'media_items';
const USER_STORE = 'users';
const DB_VERSION = 2;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event: any) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(MEDIA_STORE)) {
          db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(USER_STORE)) {
          db.createObjectStore(USER_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (e: any) {
      reject(e);
    }
  });
};

const saveUserToDB = async (user: User): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(USER_STORE, 'readwrite');
    const store = transaction.objectStore(USER_STORE);
    const request = store.put(user);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const findUserInDB = async (email: string): Promise<User | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(USER_STORE, 'readonly');
    const store = transaction.objectStore(USER_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const users = request.result as User[];
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      resolve(user || null);
    };
    request.onerror = () => reject(request.error);
  });
};

const getAllMedia = async (): Promise<MediaItem[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(MEDIA_STORE, 'readonly');
      const store = transaction.objectStore(MEDIA_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (e: any) {
    console.error("DB failed", e);
    return [];
  }
};

const saveMediaItem = async (item: MediaItem): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MEDIA_STORE, 'readwrite');
    const store = transaction.objectStore(MEDIA_STORE);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const deleteMediaItem = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MEDIA_STORE, 'readwrite');
    const store = transaction.objectStore(MEDIA_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getUserIdFromEmail = (email: string) => {
  return btoa(email.toLowerCase().trim()).replace(/=/g, '').substring(0, 16);
};

const formatTime = (time: number) => {
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// --- AUTH COMPONENTS ---

const AuthScreen = ({ onLogin, isDark }: { onLogin: (user: User) => void, isDark: boolean }) => {
  const [view, setView] = useState<AuthView>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const existingUser = await findUserInDB(email);

      if (view === 'signin') {
        if (existingUser && existingUser.password === password) {
          onLogin(existingUser);
        } else {
          setError('Invalid email or password');
        }
      } else if (view === 'signup') {
        if (existingUser) {
          setError('Email already registered');
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setIsLoading(false);
          return;
        }
        const newUser: User = { 
          id: getUserIdFromEmail(email), 
          email: email.toLowerCase().trim(), 
          password, 
          name 
        };
        await saveUserToDB(newUser);
        onLogin(newUser);
      } else if (view === 'forgot') {
        if (!existingUser) {
          setError('User not found');
          setIsLoading(false);
          return;
        }
        const updatedUser: User = { ...existingUser, password };
        await saveUserToDB(updatedUser);
        setSuccess('Password updated successfully');
        setTimeout(() => setView('signin'), 1500);
      }
    } catch (err: any) {
      setError('Database connection lost. Please reload.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center p-4 z-[200] transition-colors duration-500 ${isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-900 text-white'}`}>
      <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white rounded-full blur-[120px]" />
      </div>

      <div className={`w-full max-w-md backdrop-blur-3xl border rounded-[40px] p-8 md:p-12 shadow-2xl animate-in zoom-in-95 duration-500 ${isDark ? 'bg-zinc-900/50 border-white/5' : 'bg-white/10 border-white/10'}`}>
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-zinc-900 text-2xl font-black mb-6 shadow-xl">L</div>
          <h1 className="text-3xl font-bold tracking-tight">Lumina Gallery</h1>
          <p className="text-zinc-400 text-sm mt-2">{view === 'signin' ? 'Welcome back' : view === 'signup' ? 'Create your workspace' : 'Reset your password'}</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {view === 'signup' && (
            <input type="text" placeholder="Full Name" required disabled={isLoading} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:opacity-50" value={name} onChange={e => setName(e.target.value)} />
          )}
          <input type="email" placeholder="Email Address" required disabled={isLoading} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:opacity-50" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" required disabled={isLoading} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:opacity-50" value={password} onChange={e => setPassword(e.target.value)} />
          {view === 'signup' && (
            <input type="password" placeholder="Confirm Password" required disabled={isLoading} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:opacity-50" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          )}
          {error && <p className="text-sm text-center font-medium text-red-400 animate-pulse">{error}</p>}
          {success && <p className="text-sm text-center font-medium text-green-400">{success}</p>}
          <button disabled={isLoading} className="w-full bg-white text-zinc-900 py-4 rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl mt-4 disabled:opacity-50">
            {isLoading ? 'Processing...' : (view === 'signin' ? 'Sign In' : view === 'signup' ? 'Create Account' : 'Reset Password')}
          </button>
        </form>

        <div className="mt-8 flex flex-col items-center gap-4">
          {view === 'signin' ? (
            <>
              <button onClick={() => setView('signup')} className="text-zinc-400 text-sm hover:text-white transition-colors">Don't have an account? <span className="text-white font-bold">Sign Up</span></button>
              <button onClick={() => setView('forgot')} className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors">Forgot Password?</button>
            </>
          ) : (
            <button onClick={() => setView('signin')} className="text-zinc-400 text-sm hover:text-white transition-colors">Back to <span className="text-white font-bold">Sign In</span></button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- GALLERY COMPONENTS ---

const CustomVideoPlayer = ({ item, onToggleFullscreen }: { item: MediaItem, onToggleFullscreen: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => { if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current); };
  }, [isPlaying]);

  return (
    <div className="relative w-full h-full flex items-center justify-center group/player overflow-hidden cursor-default" onMouseMove={resetControlsTimeout} onClick={togglePlay}>
      <video ref={videoRef} key={item.url} src={item.url} className="max-w-full max-h-full object-contain bg-black" autoPlay playsInline onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
      <div className={`absolute inset-x-0 bottom-0 p-8 transition-all duration-300 transform ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`} onClick={(e) => e.stopPropagation()}>
        <div className="max-w-4xl mx-auto bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
          <div className="relative group/range mb-4 flex items-center gap-4">
            <span className="text-[10px] font-bold text-white/60 w-10 text-right">{formatTime(currentTime)}</span>
            <input type="range" min="0" max={duration || 0} step="0.01" value={currentTime} onChange={(e) => { if (videoRef.current) videoRef.current.currentTime = parseFloat(e.target.value); }} className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white" />
            <span className="text-[10px] font-bold text-white/60 w-10">{formatTime(duration)}</span>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={togglePlay} className="w-10 h-10 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform">
              {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5 ml-0.5" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onToggleFullscreen(); }} className="text-white/80 hover:text-white transition-colors p-2">
              <ExpandIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('photos');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('none');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 });
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isInitializing, setIsInitializing] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('lumina_theme') === 'dark');

  useEffect(() => {
    const init = async () => {
      try {
        const savedUserStr = localStorage.getItem('lumina_current_user');
        if (savedUserStr) setCurrentUser(JSON.parse(savedUserStr));
        const savedMedia = await getAllMedia();
        setMedia(savedMedia || []);
      } catch (e) { console.error("Gallery failed", e); }
      finally { setIsInitializing(false); }
    };
    init();
  }, []);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('lumina_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('lumina_current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('lumina_current_user');
    setSelectedIds(new Set());
  };

  const filteredMedia = useMemo(() => {
    if (!currentUser) return [];
    return media.filter(item => {
      const matchesUser = item.userId === currentUser.id;
      const matchesType = currentView === 'upload' ? true : (currentView === 'photos' ? item.type === MediaType.IMAGE : item.type === MediaType.VIDEO);
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesUser && matchesType && matchesSearch;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [media, currentView, searchQuery, currentUser]);

  const groupedMedia = useMemo(() => {
    if (groupingMode === 'none') return [{ title: null, items: filteredMedia }];
    const groups: { [key: string]: MediaItem[] } = {};
    filteredMedia.forEach(item => {
      const date = new Date(item.timestamp);
      let key = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: groupingMode === 'day' ? 'numeric' : undefined });
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).map(([title, items]) => ({ title, items }));
  }, [filteredMedia, groupingMode]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !currentUser) return;
    setIsProcessing(true);
    const fileList = Array.from(files) as File[];
    setProcessProgress({ current: 0, total: fileList.length });
    const newItems: MediaItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (isImage || isVideo) {
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
        });
        const newItem: MediaItem = {
          id: Math.random().toString(36).substring(2, 15),
          userId: currentUser.id,
          type: isImage ? MediaType.IMAGE : MediaType.VIDEO,
          url: base64Data,
          title: file.name,
          description: `Captured ${new Date().toLocaleDateString()}`,
          timestamp: Date.now()
        };
        await saveMediaItem(newItem);
        newItems.push(newItem);
      }
      setProcessProgress(prev => ({ ...prev, current: i + 1 }));
    }
    setMedia(prev => [...prev, ...newItems]);
    setIsProcessing(false);
    if (newItems.length > 0) setCurrentView(newItems[0].type === MediaType.IMAGE ? 'photos' : 'videos');
  };

  const deleteItem = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await deleteMediaItem(id);
    setMedia(prev => prev.filter(item => item.id !== id));
  };

  if (isInitializing) return <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 text-white">Loading Space...</div>;
  if (!currentUser) return <AuthScreen onLogin={handleLogin} isDark={darkMode} />;

  return (
    <div className={`h-screen h-[100dvh] w-screen flex flex-col md:flex-row overflow-hidden fixed inset-0 transition-colors duration-300 ${darkMode ? 'bg-zinc-950 text-zinc-100 dark' : 'bg-zinc-50 text-zinc-900'}`}>
      <nav className={`fixed bottom-0 left-0 right-0 z-50 backdrop-blur-lg border-t p-2 md:relative md:w-20 md:h-full md:border-r md:p-4 flex md:flex-col items-center justify-around transition-colors ${darkMode ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-zinc-200'}`}>
        <button onClick={() => setCurrentView('photos')} className={`p-3 rounded-xl ${currentView === 'photos' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950' : 'text-zinc-400'}`}><ImageIcon className="w-6 h-6" /></button>
        <button onClick={() => setCurrentView('videos')} className={`p-3 rounded-xl ${currentView === 'videos' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950' : 'text-zinc-400'}`}><VideoIcon className="w-6 h-6" /></button>
        <button onClick={() => setCurrentView('upload')} className={`p-3 rounded-xl ${currentView === 'upload' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950' : 'text-zinc-400'}`}><UploadIcon className="w-6 h-6" /></button>
        <div className="md:mt-auto flex md:flex-col items-center gap-4">
          <button onClick={() => setDarkMode(!darkMode)} className="p-3 text-zinc-400">{darkMode ? <SunIcon /> : <MoonIcon />}</button>
          <button onClick={handleLogout} className="p-3 text-red-400"><TrashIcon /></button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto pb-24 md:pb-0 p-4 md:p-8">
        <header className="flex flex-col md:flex-row justify-between gap-4 mb-8">
          <div><h2 className="text-2xl font-bold capitalize">{currentView}</h2><p className="text-zinc-400 text-xs">{filteredMedia.length} items for {currentUser.name}</p></div>
          <div className="relative w-full md:w-64"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" /><input type="text" placeholder="Search..." className={`w-full h-10 border rounded-xl pl-10 pr-4 outline-none ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
        </header>

        {currentView === 'upload' ? (
          <div className={`border-2 border-dashed rounded-3xl p-20 text-center transition-all ${darkMode ? 'bg-zinc-900/30 border-zinc-800' : 'bg-white border-zinc-200'}`}>
            {isProcessing ? <p className="animate-pulse">Processing {processProgress.current}/{processProgress.total}...</p> : (
              <label className="cursor-pointer bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 px-8 py-3 rounded-xl font-bold shadow-lg">Select Files<input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileUpload} /></label>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {filteredMedia.map(item => (
              <div key={item.id} onClick={() => setSelectedItem(item)} className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition-all">
                {item.type === MediaType.IMAGE ? <img src={item.url} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><VideoIcon className="text-zinc-600" /></div>}
                <button onClick={(e) => deleteItem(item.id, e)} className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 p-2 bg-white text-zinc-900 rounded-lg"><TrashIcon className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedItem && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedItem(null)}>
          <div className="relative w-full h-full flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            {selectedItem.type === MediaType.IMAGE ? <img src={selectedItem.url} className="max-w-full max-h-full object-contain" /> : <CustomVideoPlayer item={selectedItem} onToggleFullscreen={() => {}} />}
            <button className="absolute top-4 right-4 text-white text-xl" onClick={() => setSelectedItem(null)}>✕</button>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLES }} />
    </div>
  );
}
