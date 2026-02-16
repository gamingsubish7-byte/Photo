
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ViewType, MediaType, MediaItem, User, AuthView } from './types';
import { 
  ImageIcon, VideoIcon, UploadIcon, SearchIcon, TrashIcon, 
  PlayIcon, PauseIcon, VolumeIcon, MuteIcon, ExpandIcon, FilterIcon,
  SunIcon, MoonIcon, WhatsAppIcon
} from './components/Icons';

// --- CONSTANTS ---
const BASE_STORAGE_BYTES = 2.5 * 1024 * 1024 * 1024; // 2.5 GB
const BONUS_PER_CHECKIN = 5 * 1024 * 1024; // 5 MB
const PENALTY_PER_MISS = 75 * 1024 * 1024; // 75 MB
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
  .glow-blue { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
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
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const prefix = bytes < 0 ? '-' : '';
  const absBytes = Math.abs(bytes);
  return prefix + parseFloat((absBytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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
          name,
          checkInStreak: 0,
          bonusStorage: 0,
          lastCheckIn: Date.now() // Start with today checked in
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
  const [duplicateCount, setDuplicateCount] = useState(0);
  
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [queueTimeLeft, setQueueTimeLeft] = useState(0);
  
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('lumina_theme') === 'dark');

  const queueTimerRef = useRef<number | null>(null);

  // --- STORAGE LIMIT ---
  const totalStorageLimit = useMemo(() => {
    return BASE_STORAGE_BYTES + (currentUser?.bonusStorage || 0);
  }, [currentUser]);

  // --- STORAGE CALCULATION ---
  const getStorageUsed = (user: User, items: MediaItem[]) => {
    return items
      .filter(item => item.userId === user.id)
      .reduce((acc, item) => acc + (item.url?.length || 0), 0);
  };

  const currentStorageUsed = useMemo(() => {
    if (!currentUser) return 0;
    return getStorageUsed(currentUser, media);
  }, [media, currentUser]);

  const storagePercentage = useMemo(() => {
    return Math.min((currentStorageUsed / totalStorageLimit) * 100, 100);
  }, [currentStorageUsed, totalStorageLimit]);

  // --- DAILY CHECK-IN CHECKER ---
  const applyDailyLogic = async (user: User, currentMedia: MediaItem[]): Promise<{ user: User, mediaReset: boolean }> => {
    if (!user.lastCheckIn) return { user, mediaReset: false };
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const lastCheckInDate = new Date(user.lastCheckIn);
    const lastStart = new Date(lastCheckInDate.getFullYear(), lastCheckInDate.getMonth(), lastCheckInDate.getDate()).getTime();
    
    const diffDays = Math.floor((todayStart - lastStart) / (1000 * 60 * 60 * 24));
    
    // Grace period check: 
    // If diffDays is 1, it means the last check-in was yesterday. Today is still open. No penalty.
    // If diffDays is 2 or more, it means at least one full calendar day was missed.
    if (diffDays >= 2) {
      const missedDaysCount = diffDays - 1; // e.g., Last was Monday, Today is Wednesday. Missed all of Tuesday (1 day).
      const usedSpace = getStorageUsed(user, currentMedia);
      const totalPenalty = missedDaysCount * PENALTY_PER_MISS;
      const potentialBonus = (user.bonusStorage || 0) - totalPenalty;
      const potentialLimit = BASE_STORAGE_BYTES + potentialBonus;

      // If storage exceeds the new limit after cumulative penalties, wipe the gallery
      if (usedSpace > potentialLimit) {
        const userMedia = currentMedia.filter(item => item.userId === user.id);
        for (const item of userMedia) {
          await deleteMediaItem(item.id);
        }
        
        const updatedUser = { 
          ...user, 
          bonusStorage: 0,
          checkInStreak: 0,
          lastCheckIn: Date.now() // Reset check-in timer to today
        };
        await saveUserToDB(updatedUser);
        window.alert(`CRITICAL STORAGE WIPE: You missed ${missedDaysCount} check-in(s)! Your storage limit shrunk and couldn't fit your files. All media has been deleted and streak reset to 0.`);
        return { user: updatedUser, mediaReset: true };
      } else {
        // Apply cumulative penalty deduction
        const updatedUser = { 
          ...user, 
          bonusStorage: potentialBonus,
          checkInStreak: 0,
          lastCheckIn: user.lastCheckIn + (missedDaysCount * 24 * 60 * 60 * 1000) // Forward timer slightly to only count new misses
        };
        await saveUserToDB(updatedUser);
        window.alert(`MISSED CHECK-IN: You missed ${missedDaysCount} full day(s). Deducted ${formatBytes(totalPenalty)} storage bonus. Streak reset to 0.`);
        return { user: updatedUser, mediaReset: false };
      }
    }
    return { user, mediaReset: false };
  };

  useEffect(() => {
    const init = async () => {
      try {
        const savedUserStr = localStorage.getItem('lumina_current_user');
        const savedMedia = await getAllMedia();
        setMedia(savedMedia || []);
        
        if (savedUserStr) {
          let user = JSON.parse(savedUserStr);
          const result = await applyDailyLogic(user, savedMedia || []);
          setCurrentUser(result.user);
          localStorage.setItem('lumina_current_user', JSON.stringify(result.user));
          
          if (result.mediaReset) {
            setMedia(prev => prev.filter(item => item.userId !== result.user.id));
          }
        }
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

  const handleLogin = async (user: User) => {
    const savedMedia = await getAllMedia();
    const result = await applyDailyLogic(user, savedMedia);
    setCurrentUser(result.user);
    localStorage.setItem('lumina_current_user', JSON.stringify(result.user));
    if (result.mediaReset) {
      setMedia(prev => prev.filter(item => item.userId !== result.user.id));
    } else {
      setMedia(savedMedia);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('lumina_current_user');
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    setPendingFiles([]);
    setQueueTimeLeft(0);
  };

  const filteredMedia = useMemo<MediaItem[]>(() => {
    if (!currentUser) return [];
    return media.filter(item => {
      const matchesUser = item.userId === currentUser.id;
      const matchesType = currentView === 'photos' ? item.type === MediaType.IMAGE : item.type === MediaType.VIDEO;
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
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

      const isDuplicate = media.some(item => item.userId === currentUser.id && item.url === base64Data);
      
      if (isDuplicate) {
        setDuplicateCount(prev => prev + 1);
        return { status: 'duplicate' };
      }

      if (currentStorageUsed + base64Data.length > totalStorageLimit) {
        window.alert(`Storage limit reached! Could not upload ${file.name}.`);
        return null;
      }

      const newItem: MediaItem = {
        id: Math.random().toString(36).substring(2, 15),
        userId: currentUser.id,
        type: isImage ? MediaType.IMAGE : MediaType.VIDEO,
        url: base64Data,
        title: file.name,
        description: `Uploaded ${new Date().toLocaleDateString()}`,
        timestamp: Date.now()
      };
      
      await saveMediaItem(newItem);
      return { status: 'success', item: newItem };
    }
    return null;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !currentUser) return;

    const fileList = Array.from(files) as File[];
    const immediateFiles = fileList.slice(0, 2); 
    const queuedFiles = fileList.slice(2);

    setProcessProgress({ current: 0, total: fileList.length });
    setDuplicateCount(0);
    setIsProcessing(true);

    const immediateResults: MediaItem[] = [];
    for (let i = 0; i < immediateFiles.length; i++) {
      const res = await processFileItem(immediateFiles[i]);
      if (res && res.status === 'success' && res.item) {
        immediateResults.push(res.item);
      }
      setProcessProgress(prev => ({ ...prev, current: i + 1 }));
    }
    setMedia(prev => [...prev, ...immediateResults]);
    setIsProcessing(false);

    if (queuedFiles.length > 0) {
      setPendingFiles(queuedFiles);
      setQueueTimeLeft(120); 

      window.setTimeout(async () => {
        const filesToProcess = [...queuedFiles];
        for (let j = 0; j < filesToProcess.length; j++) {
          const file = filesToProcess[j];
          setIsProcessing(true);
          const res = await processFileItem(file);
          if (res && res.status === 'success' && res.item) {
            setMedia(prev => [...prev, res.item!]);
          }
          setPendingFiles(prev => prev.filter(f => f !== file));
          setProcessProgress(prev => ({ ...prev, current: 2 + j + 1 }));
          setIsProcessing(false);
          if (j < filesToProcess.length - 1) {
            await new Promise(r => setTimeout(r, SEQUENTIAL_DELAY));
          }
        }
        setQueueTimeLeft(0);
      }, INITIAL_QUEUE_DELAY);
    }
  };

  const handleCheckIn = async () => {
    if (!currentUser) return;
    const now = new Date();
    const last = currentUser.lastCheckIn ? new Date(currentUser.lastCheckIn) : null;
    
    const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const lastDayStr = last ? new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime() : 0;
    
    if (todayStr === lastDayStr) {
      window.alert("You've already checked in today! Come back tomorrow.");
      return;
    }
    
    const updatedUser = {
      ...currentUser,
      lastCheckIn: now.getTime(),
      checkInStreak: (currentUser.checkInStreak || 0) + 1,
      bonusStorage: (currentUser.bonusStorage || 0) + BONUS_PER_CHECKIN
    };
    
    await saveUserToDB(updatedUser);
    setCurrentUser(updatedUser);
    localStorage.setItem('lumina_current_user', JSON.stringify(updatedUser));
    window.alert(`Success! +5MB storage. Current Streak: ${updatedUser.checkInStreak} days.`);
  };

  const cleanDuplicates = async () => {
    if (!currentUser) return;
    const userMedia = media.filter(item => item.userId === currentUser.id);
    const seen = new Map<string, string>();
    const duplicates: string[] = [];

    userMedia.forEach(item => {
      if (seen.has(item.url)) duplicates.push(item.id);
      else seen.set(item.url, item.id);
    });

    if (duplicates.length === 0) {
      window.alert("No duplicates found.");
      return;
    }

    if (!window.confirm(`Found ${duplicates.length} duplicate items. Delete?`)) return;

    for (const id of duplicates) await deleteMediaItem(id);
    setMedia(prev => prev.filter(item => !duplicates.includes(item.id)));
    window.alert(`Removed ${duplicates.length} duplicates.`);
  };

  const fullCleanStorage = async () => {
    if (!currentUser) return;
    if (!window.confirm("Wipe ALL photos and videos?")) return;
    const userMedia = media.filter(item => item.userId === currentUser.id);
    for (const item of userMedia) await deleteMediaItem(item.id);
    setMedia(prev => prev.filter(item => item.userId !== currentUser.id));
    window.alert("Gallery cleared.");
  };

  const deleteItem = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await deleteMediaItem(id);
    setMedia(prev => prev.filter(item => item.id !== id));
  };

  const handleItemClick = (item: MediaItem) => {
    if (isSelectionMode) {
      const next = new Set(selectedIds);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      setSelectedIds(next);
    } else {
      setSelectedItem(item);
    }
  };

  if (isInitializing) return <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 text-white font-black text-2xl animate-pulse">LUMINA</div>;
  if (!currentUser) return <AuthScreen onLogin={handleLogin} isDark={darkMode} />;

  return (
    <div className={`h-screen h-[100dvh] w-screen flex flex-col md:flex-row overflow-hidden fixed inset-0 transition-colors duration-300 ${darkMode ? 'bg-zinc-950 text-zinc-100 dark' : 'bg-zinc-50 text-zinc-900'}`}>
      <nav className={`fixed bottom-0 left-0 right-0 z-[60] backdrop-blur-lg border-t p-2 md:relative md:w-24 md:h-full md:border-r md:p-4 flex md:flex-col items-center justify-around transition-colors ${darkMode ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-zinc-200'}`}>
        <div className="hidden md:flex w-12 h-12 bg-white text-black rounded-2xl items-center justify-center font-black text-xl mb-8 shadow-lg">L</div>
        <button onClick={() => setCurrentView('photos')} className={`p-4 rounded-2xl transition-all ${currentView === 'photos' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xl' : 'text-zinc-400 hover:text-zinc-600'}`}><ImageIcon className="w-6 h-6" /></button>
        <button onClick={() => setCurrentView('videos')} className={`p-4 rounded-2xl transition-all ${currentView === 'videos' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xl' : 'text-zinc-400 hover:text-zinc-600'}`}><VideoIcon className="w-6 h-6" /></button>
        <button onClick={() => setCurrentView('upload')} className={`p-4 rounded-2xl transition-all ${currentView === 'upload' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xl' : 'text-zinc-400 hover:text-zinc-600'}`}><UploadIcon className="w-6 h-6" /></button>
        <div className="md:mt-auto flex md:flex-col items-center gap-4">
          <a href="https://wa.me/+9779869400576" target="_blank" rel="noopener noreferrer" className="p-4 text-green-500 hover:scale-110"><WhatsAppIcon className="w-6 h-6" /></a>
          <button onClick={() => setDarkMode(!darkMode)} className="p-4 text-zinc-400">{darkMode ? <SunIcon /> : <MoonIcon />}</button>
          <button onClick={handleLogout} className="p-4 text-red-400"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth={2}/></svg></button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto pb-24 md:pb-0 p-4 md:p-12">
        <header className="flex flex-col md:flex-row justify-between gap-6 mb-12">
          <div className="flex-1">
            <h2 className="text-4xl font-black capitalize tracking-tight mb-2">{currentView}</h2>
            <div className="flex flex-col gap-2">
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">{filteredMedia.length} items • {currentUser.name}</p>
              <div className="w-full md:w-64 mt-2">
                <div className="flex justify-between text-[10px] font-bold text-zinc-500 mb-1 uppercase">
                  <span>Storage</span>
                  <span>{formatBytes(currentStorageUsed)} / {formatBytes(totalStorageLimit)}</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-500 ${storagePercentage > 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${storagePercentage}%` }} />
                </div>
              </div>
            </div>
          </div>
          {currentView !== 'upload' && (
            <div className="relative w-full md:w-80">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input type="text" placeholder="Search gallery..." className={`w-full h-14 border rounded-2xl pl-12 pr-4 outline-none ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          )}
        </header>

        {currentView === 'upload' ? (
          <div className="space-y-12 max-w-4xl">
            {/* Daily Check-in Card */}
            <div className={`p-8 rounded-[40px] border relative overflow-hidden transition-all ${darkMode ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-100 shadow-xl'}`}>
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                <SunIcon className="w-48 h-48" />
              </div>
              <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                <div className="w-24 h-24 bg-blue-500 text-white rounded-[30px] flex flex-col items-center justify-center shadow-lg shadow-blue-500/30">
                  <span className="text-3xl font-black">{currentUser.checkInStreak || 0}</span>
                  <span className="text-[10px] font-black uppercase tracking-tighter">Streak</span>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-black">Daily Check-in Centre</h3>
                  <p className="text-zinc-500 text-sm mt-1">
                    Win <span className="text-blue-500 font-bold">5MB</span> every check-in. 
                    Miss a full day and <span className="text-red-500 font-bold">75MB</span> is deducted!
                  </p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Status: </span>
                    <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${ (currentUser.bonusStorage || 0) >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500' }`}>
                      {formatBytes(currentUser.bonusStorage || 0)} Bonus
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-2 italic">⚠️ Grace period: You have until the end of the next calendar day to check in. If you miss it entirely, you lose 75MB. If your files don't fit the new limit, your gallery is wiped.</p>
                </div>
                <button 
                  onClick={handleCheckIn}
                  className="bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 px-8 py-5 rounded-2xl font-black hover:scale-105 active:scale-95 transition-all glow-blue shadow-2xl"
                >
                  Check In Now
                </button>
              </div>
            </div>

            {/* Standard Upload Area */}
            <div className={`border-4 border-dashed rounded-[40px] p-16 text-center transition-all ${darkMode ? 'bg-zinc-900/30 border-zinc-800' : 'bg-white border-zinc-200'}`}>
              {isProcessing ? (
                <div className="space-y-6">
                  <div className="w-16 h-16 border-4 border-zinc-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xl font-bold">Transferring {processProgress.current} of {processProgress.total}...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner"><UploadIcon className="w-10 h-10 text-zinc-400" /></div>
                  <h3 className="text-2xl font-black">Drop Your Media Here</h3>
                  <label className="cursor-pointer bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 px-12 py-5 rounded-2xl font-black text-lg shadow-2xl hover:scale-105 transition-all inline-block">
                    Select Files
                    <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              )}
            </div>

            {/* Storage Tools */}
            <div className={`p-8 rounded-[40px] border ${darkMode ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-100 shadow-xl'}`}>
              <h4 className="text-xl font-black mb-6">Gallery Tools</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button onClick={cleanDuplicates} className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 text-left hover:bg-blue-500/10 transition-colors">
                  <p className="font-black text-blue-500 uppercase tracking-widest text-sm mb-1">Deep Scan</p>
                  <p className="text-zinc-500 text-xs">Purge existing duplicate files.</p>
                </button>
                <button onClick={fullCleanStorage} className="p-6 rounded-3xl bg-red-500/5 border border-red-500/10 text-left hover:bg-red-500/10 transition-colors">
                  <p className="font-black text-red-500 uppercase tracking-widest text-sm mb-1">Factory Reset</p>
                  <p className="text-zinc-500 text-xs">Wipe entire storage space.</p>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6 pb-20">
            {filteredMedia.length > 0 ? filteredMedia.map(item => (
              <div key={item.id} onClick={() => handleItemClick(item)} className="group relative aspect-square rounded-[30px] overflow-hidden cursor-pointer shadow-lg hover:scale-[1.03] transition-all">
                {item.type === MediaType.IMAGE ? (
                  <img src={item.url} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center relative">
                    <img src={item.url as string} className="w-full h-full object-cover opacity-50 blur-sm absolute inset-0" />
                    <VideoIcon className="text-white w-12 h-12 relative z-10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                  <button onClick={(e) => deleteItem(item.id, e)} className="p-3 bg-red-500 text-white rounded-xl self-start hover:scale-110 transition-transform shadow-lg"><TrashIcon className="w-4 h-4" /></button>
                </div>
              </div>
            )) : (
              <div className="col-span-full py-32 text-center opacity-20"><SearchIcon className="w-24 h-24 mx-auto mb-6" /><p className="text-3xl font-black uppercase">No {currentView} found</p></div>
            )}
          </div>
        )}
      </main>

      {selectedItem && (
        <div className="fixed inset-0 z-[100] bg-black/98 backdrop-blur-2xl flex items-center justify-center p-4 md:p-12" onClick={() => setSelectedItem(null)}>
          <div className="relative w-full h-full flex flex-col items-center justify-center animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            {selectedItem.type === MediaType.IMAGE ? (
              <img src={selectedItem.url} className="max-w-full max-h-full object-contain rounded-3xl" />
            ) : (
              <CustomVideoPlayer item={selectedItem} onToggleFullscreen={() => {}} />
            )}
            <button className="absolute -top-12 md:top-0 right-0 bg-white/10 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl" onClick={() => setSelectedItem(null)}>✕</button>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLES }} />
    </div>
  );
}
