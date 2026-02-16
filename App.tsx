import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ViewType, MediaType, MediaItem, User, AuthView } from './types';
import { 
  ImageIcon, VideoIcon, UploadIcon, SearchIcon, TrashIcon, 
  PlayIcon, PauseIcon, VolumeIcon, MuteIcon, ExpandIcon, FilterIcon,
  SunIcon, MoonIcon, WhatsAppIcon
} from './components/Icons';

type GroupingMode = 'none' | 'day' | 'month' | 'year';

// --- CONSTANTS ---
const MAX_STORAGE_BYTES = 2.5 * 1024 * 1024 * 1024; // 2.5 GB
const INITIAL_QUEUE_DELAY = 2 * 60 * 1000; // 2 minutes
const SEQUENTIAL_DELAY = 2000; // 2 seconds

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
  .selection-ring { box-shadow: 0 0 0 4px #3b82f6; }
  .queue-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
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

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 });
  
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [queueTimeLeft, setQueueTimeLeft] = useState(0);
  
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('lumina_theme') === 'dark');

  const queueTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const savedUserStr = localStorage.getItem('lumina_current_user');
        if (savedUserStr) setCurrentUser(JSON.parse(savedUserStr));
        const savedMedia = await getAllMedia();
        setMedia(savedMedia || []);
        // Fix: Add explicit 'any' type to catch block for 'unknown' error that can occur in strict mode
      } catch (e: any) { console.error("Gallery failed", e); }
      finally { setIsInitializing(false); }
    };
    init();
    return () => {
      if (queueTimerRef.current) window.clearInterval(queueTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('lumina_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Handle countdown for queue
  useEffect(() => {
    let interval: number;
    if (queueTimeLeft > 0) {
      interval = window.setInterval(() => {
        setQueueTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [queueTimeLeft]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('lumina_current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('lumina_current_user');
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    setPendingFiles([]);
    setQueueTimeLeft(0);
  };

  // --- STORAGE CALCULATION ---
  const currentStorageUsed = useMemo(() => {
    if (!currentUser) return 0;
    return media
      .filter(item => item.userId === currentUser.id)
      .reduce((acc, item) => acc + (item.url?.length || 0), 0);
  }, [media, currentUser]);

  const storagePercentage = useMemo(() => {
    return Math.min((currentStorageUsed / MAX_STORAGE_BYTES) * 100, 100);
  }, [currentStorageUsed]);

  const filteredMedia = useMemo(() => {
    if (!currentUser) return [];
    return media.filter(item => {
      const matchesUser = item.userId === currentUser.id;
      const matchesType = currentView === 'photos' ? item.type === MediaType.IMAGE : item.type === MediaType.VIDEO;
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
      
      // In Photos view, only show images. In Videos view, only show videos.
      return matchesUser && matchesType && matchesSearch;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [media, currentView, searchQuery, currentUser]);

  const processFileItem = async (file: File) => {
    if (!currentUser) return null;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (isImage || isVideo) {
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
      });

      if (currentStorageUsed + base64Data.length > MAX_STORAGE_BYTES) {
        // Fix: Use window.alert to avoid potential 'unknown' type issues with global identifiers in some TS environments.
        window.alert(`Storage limit reached! Could not upload ${file.name}.`);
        return null;
      }

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
      return newItem;
    }
    return null;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !currentUser) return;

    const fileList = Array.from(files) as File[];
    const immediateFiles = fileList.slice(0, 2); // Now only 2 instant
    const queuedFiles = fileList.slice(2);

    setProcessProgress({ current: 0, total: fileList.length });
    setIsProcessing(true);

    // Process first 2 immediately
    const immediateResults: MediaItem[] = [];
    for (let i = 0; i < immediateFiles.length; i++) {
      const res = await processFileItem(immediateFiles[i]);
      if (res) immediateResults.push(res);
      setProcessProgress(prev => ({ ...prev, current: i + 1 }));
    }
    setMedia(prev => [...prev, ...immediateResults]);
    setIsProcessing(false);

    // Handle the remaining queue
    if (queuedFiles.length > 0) {
      setPendingFiles(queuedFiles);
      setQueueTimeLeft(120); // 2 minutes

      // Initial 2-minute wait
      window.setTimeout(async () => {
        const filesToProcess = [...queuedFiles];
        for (let j = 0; j < filesToProcess.length; j++) {
          const file = filesToProcess[j];
          
          setIsProcessing(true);
          const res = await processFileItem(file);
          if (res) {
            setMedia(prev => [...prev, res]);
          }
          
          // Remove from pending UI
          setPendingFiles(prev => prev.filter(f => f !== file));
          setProcessProgress(prev => ({ ...prev, current: 2 + j + 1 }));
          setIsProcessing(false);

          // 2 seconds delay between each file after the first queue wait
          if (j < filesToProcess.length - 1) {
            await new Promise(r => setTimeout(r, SEQUENTIAL_DELAY));
          }
        }
        setQueueTimeLeft(0);
      }, INITIAL_QUEUE_DELAY);
    }
  };

  const deleteItem = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await deleteMediaItem(id);
    setMedia(prev => prev.filter(item => item.id !== id));
    if (selectedIds.has(id)) {
      const next = new Set(selectedIds);
      next.delete(id);
      setSelectedIds(next);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    // Fix: Use window.confirm to avoid potential 'unknown' type issues with global identifiers in some TS environments.
    if (!window.confirm(`Delete ${selectedIds.size} items?`)) return;
    
    const idsToDelete = Array.from(selectedIds);
    for (const id of idsToDelete) {
      await deleteMediaItem(id);
    }
    setMedia(prev => prev.filter(item => !selectedIds.has(item.id)));
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const toggleItemSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleItemClick = (item: MediaItem) => {
    if (isSelectionMode) {
      toggleItemSelection(item.id);
    } else {
      setSelectedItem(item);
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  if (isInitializing) return <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 text-white font-black text-2xl animate-pulse">LUMINA</div>;
  if (!currentUser) return <AuthScreen onLogin={handleLogin} isDark={darkMode} />;

  return (
    <div className={`h-screen h-[100dvh] w-screen flex flex-col md:flex-row overflow-hidden fixed inset-0 transition-colors duration-300 ${darkMode ? 'bg-zinc-950 text-zinc-100 dark' : 'bg-zinc-50 text-zinc-900'}`}>
      <nav className={`fixed bottom-0 left-0 right-0 z-[60] backdrop-blur-lg border-t p-2 md:relative md:w-24 md:h-full md:border-r md:p-4 flex md:flex-col items-center justify-around transition-colors ${darkMode ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-zinc-200'}`}>
        <div className="hidden md:flex w-12 h-12 bg-white text-black rounded-2xl items-center justify-center font-black text-xl mb-8 shadow-lg">L</div>
        
        <button onClick={() => { setCurrentView('photos'); exitSelectionMode(); }} className={`p-4 rounded-2xl transition-all ${currentView === 'photos' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xl' : 'text-zinc-400 hover:text-zinc-600'}`} title="Photos"><ImageIcon className="w-6 h-6" /></button>
        <button onClick={() => { setCurrentView('videos'); exitSelectionMode(); }} className={`p-4 rounded-2xl transition-all ${currentView === 'videos' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xl' : 'text-zinc-400 hover:text-zinc-600'}`} title="Videos"><VideoIcon className="w-6 h-6" /></button>
        <button onClick={() => { setCurrentView('upload'); exitSelectionMode(); }} className={`p-4 rounded-2xl transition-all ${currentView === 'upload' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xl' : 'text-zinc-400 hover:text-zinc-600'}`} title="Upload"><UploadIcon className="w-6 h-6" /></button>
        
        <div className="md:mt-auto flex md:flex-col items-center gap-4">
          <a href="https://wa.me/+9779869400576" target="_blank" rel="noopener noreferrer" className="p-4 text-green-500 hover:scale-110 transition-transform" title="Contact Us on WhatsApp">
            <WhatsAppIcon className="w-6 h-6" />
          </a>
          <button onClick={() => setDarkMode(!darkMode)} className="p-4 text-zinc-400 hover:text-zinc-600">{darkMode ? <SunIcon /> : <MoonIcon />}</button>
          <button onClick={handleLogout} className="p-4 text-red-400 hover:scale-110 transition-transform"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto pb-24 md:pb-0 p-4 md:p-12">
        <header className="flex flex-col md:flex-row justify-between gap-6 mb-12">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              <h2 className="text-4xl font-black capitalize tracking-tight">{currentView}</h2>
              {currentView !== 'upload' && filteredMedia.length > 0 && (
                <button 
                  onClick={() => isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true)}
                  className={`ml-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${isSelectionMode ? 'bg-blue-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-300'}`}
                >
                  {isSelectionMode ? 'Cancel' : 'Select'}
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">
                {currentView === 'upload' ? 'Upload Center' : `${filteredMedia.length} items`} • {currentUser.name}
              </p>
              
              <div className="w-full md:w-64 mt-2">
                <div className="flex justify-between text-[10px] font-bold text-zinc-500 mb-1 uppercase tracking-tighter">
                  <span>Storage Used</span>
                  <span>{formatBytes(currentStorageUsed)} / 2.5 GB</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${storagePercentage > 90 ? 'bg-red-500' : 'bg-blue-500'}`} 
                    style={{ width: `${storagePercentage}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4">
            {isSelectionMode && selectedIds.size > 0 && (
              <button 
                onClick={deleteSelected}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-4 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all w-full md:w-auto"
              >
                <TrashIcon className="w-5 h-5" />
                Delete Selected ({selectedIds.size})
              </button>
            )}
            
            {currentView !== 'upload' && (
              <div className="relative w-full md:w-80">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input 
                  type="text" 
                  placeholder="Search your gallery..." 
                  className={`w-full h-14 border rounded-2xl pl-12 pr-4 outline-none font-medium transition-all focus:ring-2 focus:ring-zinc-200 ${darkMode ? 'bg-zinc-900 border-zinc-800 focus:ring-zinc-800' : 'bg-white border-zinc-200'}`} 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                />
              </div>
            )}
          </div>
        </header>

        {currentView === 'upload' ? (
          <div className="space-y-12 max-w-4xl">
            {/* Upload Area */}
            <div className={`border-4 border-dashed rounded-[40px] p-24 text-center transition-all ${darkMode ? 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 hover:border-zinc-300'}`}>
              {isProcessing ? (
                <div className="space-y-6">
                  <div className="w-16 h-16 border-4 border-zinc-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xl font-bold">Transferring {processProgress.current} of {processProgress.total}...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                    <UploadIcon className="w-10 h-10 text-zinc-400" />
                  </div>
                  <h3 className="text-2xl font-black">Upload New Memories</h3>
                  <p className="text-zinc-500 max-w-sm mx-auto mb-8">Drag and drop or select files. First 2 are instant, others enter a 2-minute batch queue.</p>
                  <label className="cursor-pointer bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 px-12 py-5 rounded-2xl font-black text-lg shadow-2xl hover:scale-105 active:scale-95 transition-all inline-block">
                    Select Files
                    <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              )}
            </div>

            {/* Queue Visualization */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-xl font-black tracking-tight flex items-center gap-3">
                  Upload Queue 
                  {pendingFiles.length > 0 && <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">{pendingFiles.length} pending</span>}
                </h4>
                {queueTimeLeft > 0 && (
                  <div className="flex items-center gap-2 text-blue-500 font-black tabular-nums">
                    <span className="text-xs uppercase tracking-widest opacity-60">Wait time:</span>
                    <span className="text-2xl">{formatTime(queueTimeLeft)}</span>
                  </div>
                )}
              </div>

              {pendingFiles.length > 0 ? (
                <div className={`rounded-[30px] border p-6 ${darkMode ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-100 shadow-xl'}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {pendingFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-3 rounded-2xl bg-zinc-500/5 border border-zinc-500/10 animate-in">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                          {file.type.startsWith('image') ? <ImageIcon className="w-5 h-5 text-blue-500" /> : <VideoIcon className="w-5 h-5 text-blue-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{file.name}</p>
                          <p className="text-[10px] text-zinc-400 uppercase tracking-tighter">
                            {idx === 0 && queueTimeLeft > 0 ? 'Next in line' : 'Waiting in batch'}
                          </p>
                        </div>
                        {idx === 0 && queueTimeLeft > 0 && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full queue-pulse" />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="mt-8 text-center text-xs font-bold text-zinc-500 uppercase tracking-widest italic animate-pulse">
                    "Stay on this page until queue clears"
                  </p>
                </div>
              ) : (
                <div className="h-32 rounded-[30px] border border-dashed flex items-center justify-center text-zinc-400 font-bold uppercase tracking-widest opacity-20">
                  Queue is empty
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6">
            {filteredMedia.length > 0 ? filteredMedia.map(item => {
              const isSelected = selectedIds.has(item.id);
              return (
                <div 
                  key={item.id} 
                  onClick={() => handleItemClick(item)} 
                  className={`group relative aspect-square rounded-[30px] overflow-hidden cursor-pointer transition-all shadow-lg active:scale-95 ${isSelected ? 'selection-ring scale-[0.97]' : 'hover:scale-[1.03]'}`}
                >
                  {item.type === MediaType.IMAGE ? (
                    <img src={item.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                      <VideoIcon className="text-zinc-600 w-12 h-12" />
                      <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-1.5 rounded-lg">
                        <VideoIcon className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}

                  {isSelectionMode && (
                    <div className={`absolute top-4 left-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500 shadow-lg' : 'bg-black/20 border-white/50'}`}>
                      {isSelected && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  )}

                  <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-opacity p-4 flex flex-col justify-end ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <div className="flex justify-between items-center">
                      {!isSelectionMode && (
                        <button onClick={(e) => deleteItem(item.id, e)} className="p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors shadow-lg">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                      <div className="ml-auto p-3 bg-white/20 backdrop-blur-md text-white rounded-xl shadow-lg">
                        <ExpandIcon className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="col-span-full py-32 text-center opacity-20">
                <SearchIcon className="w-24 h-24 mx-auto mb-6" />
                <p className="text-3xl font-black uppercase tracking-widest">No {currentView} yet</p>
              </div>
            )}
          </div>
        )}
      </main>

      {selectedItem && (
        <div className="fixed inset-0 z-[100] bg-black/98 backdrop-blur-2xl flex items-center justify-center p-4 md:p-12" onClick={() => setSelectedItem(null)}>
          <div className="relative w-full h-full flex flex-col items-center justify-center animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            {selectedItem.type === MediaType.IMAGE ? (
              <img src={selectedItem.url} className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl shadow-white/5" />
            ) : (
              <CustomVideoPlayer item={selectedItem} onToggleFullscreen={() => {}} />
            )}
            <button className="absolute -top-4 -right-4 md:top-0 md:right-0 bg-white/10 hover:bg-white/20 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all" onClick={() => setSelectedItem(null)}>✕</button>
            <div className="absolute bottom-[-40px] left-0 right-0 text-center">
               <p className="text-white/60 font-bold text-sm tracking-widest uppercase">{selectedItem.title}</p>
            </div>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLES }} />
    </div>
  );
}