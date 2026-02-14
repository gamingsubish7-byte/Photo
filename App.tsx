
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ViewType, MediaType, MediaItem, User, AuthView } from './types';
import { 
  ImageIcon, VideoIcon, UploadIcon, SearchIcon, TrashIcon, 
  PlayIcon, PauseIcon, VolumeIcon, MuteIcon, ExpandIcon, FilterIcon,
  SunIcon, MoonIcon
} from './components/Icons';

type GroupingMode = 'none' | 'day' | 'month' | 'year';

// --- DATABASE SERVICE (IndexedDB for Safari-friendly large persistence) ---
const DB_NAME = 'LuminaGalleryDB';
const STORE_NAME = 'media_items';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getAllMedia = async (): Promise<MediaItem[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveMediaItem = async (item: MediaItem): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const deleteMediaItem = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Helper function to format seconds into M:SS string
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
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const users: User[] = JSON.parse(localStorage.getItem('lumina_users') || '[]');

    if (view === 'signin') {
      const user = users.find(u => u.email === email && u.password === password);
      if (user) {
        onLogin(user);
      } else {
        setError('Invalid email or password');
      }
    } else if (view === 'signup') {
      if (users.some(u => u.email === email)) {
        setError('Email already exists');
        return;
      }
      const newUser: User = { id: Math.random().toString(36).substr(2, 9), email, password, name };
      localStorage.setItem('lumina_users', JSON.stringify([...users, newUser]));
      onLogin(newUser);
    } else {
      setError('Password reset link sent to ' + email);
      setTimeout(() => setView('signin'), 2000);
    }
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center p-4 z-[200] ${isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-900 text-white'}`}>
      <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white rounded-full blur-[120px]" />
      </div>

      <div className={`w-full max-w-md backdrop-blur-3xl border rounded-[40px] p-8 md:p-12 shadow-2xl animate-in zoom-in-95 duration-500 ${isDark ? 'bg-zinc-900/50 border-white/5' : 'bg-white/10 border-white/10'}`}>
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-zinc-900 text-2xl font-black mb-6 shadow-xl">L</div>
          <h1 className="text-3xl font-bold tracking-tight">Lumina Gallery</h1>
          <p className="text-zinc-400 text-sm mt-2">
            {view === 'signin' ? 'Welcome back' : view === 'signup' ? 'Create your workspace' : 'Reset your access'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {view === 'signup' && (
            <input
              type="text"
              placeholder="Full Name"
              required
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:ring-2 focus:ring-white/20 transition-all"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          )}
          <input
            type="email"
            placeholder="Email Address"
            required
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:ring-2 focus:ring-white/20 transition-all"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          {view !== 'forgot' && (
            <input
              type="password"
              placeholder="Password"
              required
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:ring-2 focus:ring-white/20 transition-all"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          )}

          {error && <p className={`text-sm text-center font-medium ${error.includes('sent') ? 'text-green-400' : 'text-red-400'}`}>{error}</p>}

          <button className="w-full bg-white text-zinc-900 py-4 rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl mt-4">
            {view === 'signin' ? 'Sign In' : view === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-8 flex flex-col items-center gap-4">
          {view === 'signin' ? (
            <>
              <button onClick={() => setView('signup')} className="text-zinc-400 text-sm hover:text-white transition-colors">Don't have an account? <span className="text-white font-bold">Sign Up</span></button>
              <button onClick={() => setView('forgot')} className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors">Forgot Password?</button>
            </>
          ) : (
            <button onClick={() => setView('signin')} className="text-zinc-400 text-sm hover:text-white transition-colors">Already have an account? <span className="text-white font-bold">Sign In</span></button>
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
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    videoRef.current.muted = newMuted;
    if (newMuted) {
      setVolume(0);
    } else {
      setVolume(videoRef.current.volume || 1);
    }
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
    return () => {
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  return (
    <div 
      className="relative w-full h-full flex items-center justify-center group/player overflow-hidden cursor-default"
      onMouseMove={resetControlsTimeout}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        key={item.url}
        src={item.url}
        className="max-w-full max-h-full object-contain bg-black"
        autoPlay
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      <div 
        className={`absolute inset-x-0 bottom-0 p-4 md:p-8 transition-all duration-300 transform ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-4xl mx-auto bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
          <div className="relative group/range mb-4 flex items-center gap-4">
            <span className="text-[10px] font-bold text-white/60 w-10 text-right">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.01"
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
            />
            <span className="text-[10px] font-bold text-white/60 w-10">{formatTime(duration)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={togglePlay}
                className="w-10 h-10 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform"
              >
                {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5 ml-0.5" />}
              </button>
              <div className="flex items-center gap-2 group/volume ml-2">
                <button onClick={toggleMute} className="text-white/80 hover:text-white transition-colors">
                  {isMuted || volume === 0 ? <MuteIcon className="w-5 h-5" /> : <VolumeIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleFullscreen(); }}
              className="text-white/80 hover:text-white transition-colors p-2"
            >
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
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('lumina_theme') === 'dark');

  // Initialization & Load (IndexedDB sync)
  useEffect(() => {
    const init = async () => {
      const savedUser = localStorage.getItem('lumina_current_user');
      if (savedUser) setCurrentUser(JSON.parse(savedUser));
      try {
        const savedMedia = await getAllMedia();
        setMedia(savedMedia);
      } catch (e) {
        console.error("Failed to load IndexedDB media", e);
      }
    };
    init();
  }, []);

  // Theme Persistence
  useEffect(() => {
    localStorage.setItem('lumina_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleTheme = () => setDarkMode(!darkMode);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('lumina_current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('lumina_current_user');
    setSelectedIds(new Set());
  };

  const formatDuration = (seconds?: number) => {
    if (seconds === undefined) return '';
    return formatTime(seconds);
  };

  const getVideoDuration = (url: string): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => resolve(0);
      video.src = url;
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const filteredMedia = useMemo(() => {
    if (!currentUser) return [];
    return media.filter(item => {
      const matchesUser = item.userId === currentUser.id;
      const matchesType = currentView === 'upload' ? true : (currentView === 'photos' ? item.type === MediaType.IMAGE : item.type === MediaType.VIDEO);
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesUser && matchesType && matchesSearch;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [media, currentView, searchQuery, currentUser]);

  const groupedMedia = useMemo(() => {
    if (groupingMode === 'none') return [{ title: null, items: filteredMedia }];
    const groups: { [key: string]: MediaItem[] } = {};
    filteredMedia.forEach(item => {
      const date = new Date(item.timestamp);
      let key = '';
      if (groupingMode === 'day') key = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      else if (groupingMode === 'month') key = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
      else if (groupingMode === 'year') key = date.toLocaleDateString(undefined, { year: 'numeric' });
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
        try {
          const base64Data = await fileToBase64(file);
          let duration;
          if (isVideo) duration = await getVideoDuration(base64Data);

          const newItem: MediaItem = {
            id: Math.random().toString(36).substr(2, 9),
            userId: currentUser.id,
            type: isImage ? MediaType.IMAGE : MediaType.VIDEO,
            url: base64Data,
            title: isImage ? 'Photo' : 'Video',
            description: `Captured on ${new Date().toLocaleDateString()}`,
            tags: [],
            timestamp: Date.now(),
            duration
          };

          await saveMediaItem(newItem);
          newItems.push(newItem);
        } catch (e) {
          console.error('File storage failed', e);
        }
      }
      setProcessProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setMedia(prev => [...prev, ...newItems]);
    setIsProcessing(false);
    if (newItems.length > 0) setCurrentView(newItems[0].type === MediaType.IMAGE ? 'photos' : 'videos');
  };

  const deleteItem = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await deleteMediaItem(id);
      setMedia(prev => prev.filter(item => item.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (selectedItem?.id === id) setSelectedItem(null);
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const handleBulkDelete = async () => {
    const idsToDelete = Array.from(selectedIds);
    try {
      await Promise.all(idsToDelete.map(id => deleteMediaItem(id)));
      setMedia(prev => prev.filter(item => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
      if (selectedItem && selectedIds.has(selectedItem.id)) setSelectedItem(null);
    } catch (e) {
      console.error("Bulk delete failed", e);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredMedia.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredMedia.map(m => m.id)));
  };

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleItemClick = (item: MediaItem) => {
    if (selectedIds.size > 0) {
      const next = new Set(selectedIds);
      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
      setSelectedIds(next);
    } else {
      setSelectedItem(item);
    }
  };

  if (!currentUser) return <AuthScreen onLogin={handleLogin} isDark={darkMode} />;

  return (
    <div className={`h-screen h-[100dvh] w-screen flex flex-col md:flex-row overflow-hidden fixed inset-0 transition-colors duration-300 ${darkMode ? 'bg-zinc-950 text-zinc-100 dark' : 'bg-zinc-50 text-zinc-900'}`}>
      {/* Sidebar Navigation */}
      <nav className={`fixed bottom-0 left-0 right-0 z-50 backdrop-blur-lg border-t p-2 md:relative md:w-20 md:h-full md:border-t-0 md:border-r md:p-4 md:flex-shrink-0 transition-colors duration-300 ${darkMode ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-zinc-200'}`}>
        <div className="flex flex-row justify-around md:flex-col md:gap-6 h-full items-center">
          <div className="hidden md:flex flex-col items-center mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shadow-lg transition-colors ${darkMode ? 'bg-white text-zinc-950' : 'bg-zinc-900 text-white'}`}>L</div>
          </div>

          <button onClick={() => { setCurrentView('photos'); setSelectedIds(new Set()); }} className={`p-3 rounded-xl transition-all ${currentView === 'photos' ? (darkMode ? 'bg-white text-zinc-950 shadow-lg' : 'bg-zinc-900 text-white shadow-lg') : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`} title="Photos"><ImageIcon className="w-6 h-6" /></button>
          <button onClick={() => { setCurrentView('videos'); setSelectedIds(new Set()); }} className={`p-3 rounded-xl transition-all ${currentView === 'videos' ? (darkMode ? 'bg-white text-zinc-950 shadow-lg' : 'bg-zinc-900 text-white shadow-lg') : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`} title="Videos"><VideoIcon className="w-6 h-6" /></button>
          <button onClick={() => { setCurrentView('upload'); setSelectedIds(new Set()); }} className={`p-3 rounded-xl transition-all ${currentView === 'upload' ? (darkMode ? 'bg-white text-zinc-950 shadow-lg' : 'bg-zinc-900 text-white shadow-lg') : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`} title="Upload"><UploadIcon className="w-6 h-6" /></button>
          
          <div className="md:mt-auto flex md:flex-col items-center gap-4">
             <button onClick={toggleTheme} className="p-3 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all" title="Toggle Theme">
               {darkMode ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
             </button>
             <button onClick={handleLogout} className="p-3 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all" title="Sign Out">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
             </button>
             <div className={`hidden md:flex w-10 h-10 rounded-full items-center justify-center text-[10px] font-bold uppercase ${darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-500'}`}>{currentUser.name.charAt(0)}</div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto scroll-smooth pb-20 md:pb-0 h-full">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold capitalize flex items-center gap-3">
                  {currentView}
                  {currentView !== 'upload' && filteredMedia.length > 0 && (
                    <button onClick={handleSelectAll} className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${selectedIds.size === filteredMedia.length ? (darkMode ? 'bg-white text-zinc-950' : 'bg-zinc-900 text-white') : (darkMode ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200')}`}>
                      {selectedIds.size === filteredMedia.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </h2>
                <p className="text-zinc-400 text-xs mt-0.5">{filteredMedia.length} items for {currentUser.name}</p>
              </div>
              {selectedIds.size > 0 && (
                <div className={`flex items-center gap-3 pl-4 border-l animate-in slide-in-from-left-2 ${darkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
                  <span className="text-sm font-bold">{selectedIds.size} selected</span>
                  <button onClick={handleBulkDelete} className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 rounded-lg text-xs font-bold transition-all"><TrashIcon className="w-3.5 h-3.5" />Delete</button>
                  <button onClick={() => setSelectedIds(new Set())} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-medium">Cancel</button>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {currentView !== 'upload' && (
                <div className={`flex items-center border rounded-xl p-1 shadow-sm h-10 transition-colors ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                  <div className="px-2 text-zinc-400"><FilterIcon className="w-4 h-4" /></div>
                  {(['none', 'day', 'month', 'year'] as GroupingMode[]).map((mode) => (
                    <button key={mode} onClick={() => setGroupingMode(mode)} className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${groupingMode === mode ? (darkMode ? 'bg-white text-zinc-950 shadow-md' : 'bg-zinc-900 text-white shadow-md') : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>{mode === 'none' ? 'Flat' : mode}</button>
                  ))}
                </div>
              )}
              <div className="relative group w-full sm:w-64">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input type="text" placeholder="Search..." className={`w-full h-10 border rounded-xl py-1.5 pl-10 pr-4 outline-none focus:ring-2 shadow-sm text-sm transition-colors ${darkMode ? 'bg-zinc-900 border-zinc-800 focus:ring-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 focus:ring-zinc-100 text-zinc-900'}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
          </div>

          {currentView === 'upload' && (
            <div className="mb-10">
              <div className={`flex flex-col items-center justify-center min-h-[30vh] border-2 border-dashed rounded-3xl p-8 text-center shadow-sm relative overflow-hidden transition-colors ${darkMode ? 'bg-zinc-900/30 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                {isProcessing && (
                  <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-8 animate-in fade-in backdrop-blur-sm ${darkMode ? 'bg-zinc-900/90' : 'bg-white/90'}`}>
                    <div className="w-full max-w-xs">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-bold">Syncing to disk...</span>
                        <span className="text-xs text-zinc-500 font-medium">{processProgress.current}/{processProgress.total}</span>
                      </div>
                      <div className={`h-2 w-full rounded-full overflow-hidden ${darkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                        <div className={`h-full transition-all duration-300 rounded-full ${darkMode ? 'bg-white' : 'bg-zinc-900'}`} style={{ width: `${(processProgress.current / processProgress.total) * 100}%` }} />
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-4 text-center font-bold uppercase tracking-wider">IndexedDB optimized for Safari</p>
                    </div>
                  </div>
                )}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-50 border-zinc-100'}`}><UploadIcon className="w-6 h-6 text-zinc-400" /></div>
                <h3 className="text-sm font-bold mb-1">Upload Media</h3>
                <p className="text-zinc-400 mb-6 max-w-xs text-[11px]">Large files are stored locally in your browser database.</p>
                <label className={`cursor-pointer px-5 py-2 rounded-xl font-bold transition-all shadow-md inline-flex items-center gap-2 text-xs ${darkMode ? 'bg-white text-zinc-950 hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}>
                  <UploadIcon className="w-3.5 h-3.5" />
                  Select Files
                  <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileUpload} disabled={isProcessing} />
                </label>
              </div>
            </div>
          )}

          {filteredMedia.length > 0 ? (
            <div className="space-y-12">
              {groupedMedia.map((group, groupIdx) => (
                <div key={group.title || 'main'} className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${groupIdx * 50}ms` }}>
                  {group.title && (
                    <div className={`sticky top-0 z-20 py-4 backdrop-blur-md mb-4 border-b transition-colors ${darkMode ? 'bg-zinc-950/90 border-zinc-900' : 'bg-zinc-50/90 border-zinc-100'}`}>
                      <h3 className="text-sm font-bold tracking-tight">{group.title}</h3>
                    </div>
                  )}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 md:gap-4">
                    {group.items.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <div key={item.id} onClick={() => handleItemClick(item)} className={`group relative aspect-square rounded-lg md:rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${darkMode ? 'bg-zinc-900' : 'bg-zinc-200'} ${isSelected ? (darkMode ? 'ring-4 ring-white ring-inset scale-95' : 'ring-4 ring-zinc-900 ring-inset scale-95') : 'hover:ring-2 hover:ring-zinc-400 hover:-translate-y-1'}`}>
                          <div onClick={(e) => toggleSelection(item.id, e)} className={`absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${isSelected ? (darkMode ? 'bg-white border-white' : 'bg-zinc-900 border-zinc-900') : 'bg-black/20 border-white/50 opacity-0 group-hover:opacity-100'}`}>
                            {isSelected && <svg className={`w-3 h-3 ${darkMode ? 'text-zinc-900' : 'text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          {item.type === MediaType.IMAGE ? (
                            <img src={item.url} alt="" loading="lazy" className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${isSelected ? 'opacity-70' : ''}`} />
                          ) : (
                            <div className="relative w-full h-full">
                              <video key={item.url} src={item.url} className={`w-full h-full object-cover ${isSelected ? 'opacity-70' : ''}`} muted loop playsInline onMouseEnter={(e) => !isSelected && e.currentTarget.play()} onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }} />
                              <div className="absolute top-1.5 right-1.5 bg-black/40 backdrop-blur-md p-1 rounded-md text-white"><VideoIcon className="w-3 h-3" /></div>
                              {item.duration && <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white pointer-events-none group-hover:opacity-0">{formatDuration(item.duration)}</div>}
                            </div>
                          )}
                          {selectedIds.size === 0 && <button onClick={(e) => deleteItem(item.id, e)} className={`absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1.5 transition-all rounded-lg shadow-sm ${darkMode ? 'bg-white text-zinc-900 hover:text-red-600' : 'bg-white/90 text-zinc-900 hover:text-red-600'}`}><TrashIcon className="w-3.5 h-3.5" /></button>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-40 flex flex-col items-center text-zinc-300 text-center animate-in fade-in slide-in-from-top-4">
               <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200/50'}`}>
                  {currentView === 'photos' ? <ImageIcon className="w-10 h-10 opacity-40 text-zinc-400" /> : <VideoIcon className="w-10 h-10 opacity-40 text-zinc-400" />}
               </div>
               <h3 className="text-lg font-bold text-zinc-400 mb-1">No {currentView} yet</h3>
               <p className="max-w-xs text-sm text-zinc-400 font-medium">Your library is currently empty. Start by uploading some memories!</p>
            </div>
          )}
        </div>
      </main>

      {selectedItem && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-2 md:p-10" onClick={() => setSelectedItem(null)}>
          <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="relative w-full h-full flex items-center justify-center">
              {selectedItem.type === MediaType.IMAGE ? (
                <img src={selectedItem.url} alt="" className="max-w-full max-h-full object-contain shadow-2xl rounded-sm" />
              ) : (
                <CustomVideoPlayer item={selectedItem} onToggleFullscreen={() => { const video = document.querySelector('video.max-w-full') as HTMLVideoElement; if (video?.requestFullscreen) video.requestFullscreen(); }} />
              )}
            </div>
            <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
              <button onClick={() => { const link = document.createElement('a'); link.href = selectedItem.url; link.download = `${selectedItem.type}_${selectedItem.id}`; link.click(); }} className="bg-white/10 hover:bg-white/20 p-2.5 rounded-full text-white transition-all backdrop-blur-md"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
              <button className="bg-white/10 hover:bg-white/20 p-2.5 rounded-full text-white transition-all backdrop-blur-md" onClick={() => setSelectedItem(null)}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 bg-black/50 backdrop-blur-xl border border-white/10 rounded-full text-white/70 text-[10px] font-bold tracking-widest uppercase pointer-events-none">
              {selectedItem.description} {selectedItem.type === MediaType.VIDEO && `• ${formatTime(selectedItem.duration || 0)}`}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .animate-in { animation: fadeIn 0.2s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .zoom-in-95 { animation: zoomIn 0.2s ease-out; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #e4e4e7; border-radius: 10px; }
        .dark ::-webkit-scrollbar-thumb { background: #3f3f46; }
        html, body { height: 100%; overflow: hidden; margin: 0; padding: 0; }
      `}} />
    </div>
  );
}
