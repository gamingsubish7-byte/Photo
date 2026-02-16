
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ViewType, MediaType, MediaItem, User, AuthView } from './types';
import { 
  ImageIcon, VideoIcon, UploadIcon, SearchIcon, TrashIcon, 
  PlayIcon, PauseIcon, VolumeIcon, MuteIcon, ExpandIcon, FilterIcon,
  SunIcon, MoonIcon
} from './components/Icons';

// --- CONFIGURATION ---
const FOLDER_NAME = 'LuminaGalaxy Uploads';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive';
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

// Note: In a production app, the Client ID should be in an env variable.
// Since we don't have one provided, we use a placeholder that would be configured.
const CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"; 

// --- GLOBAL STYLES ---
const GLOBAL_STYLES = `
  .animate-in { animation: fadeIn 0.2s ease-out; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .dark ::-webkit-scrollbar-thumb { background: #3f3f46; }
  .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); }
`;

// --- LOCAL DATABASE (Tracks app-specific file IDs) ---
const DB_NAME = 'LuminaGalaxyDB';
const TRACKED_FILES_STORE = 'tracked_files';
const USER_STORE = 'users';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = (e: any) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TRACKED_FILES_STORE)) db.createObjectStore(TRACKED_FILES_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(USER_STORE)) db.createObjectStore(USER_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const trackFile = async (item: MediaItem) => {
  const db = await openDB();
  return new Promise((r) => {
    const tx = db.transaction(TRACKED_FILES_STORE, 'readwrite');
    tx.objectStore(TRACKED_FILES_STORE).put(item);
    tx.oncomplete = () => r(true);
  });
};

const untrackFile = async (id: string) => {
  const db = await openDB();
  return new Promise((r) => {
    const tx = db.transaction(TRACKED_FILES_STORE, 'readwrite');
    tx.objectStore(TRACKED_FILES_STORE).delete(id);
    tx.oncomplete = () => r(true);
  });
};

const getTrackedFileIds = async (): Promise<Set<string>> => {
  const db = await openDB();
  return new Promise((r) => {
    const tx = db.transaction(TRACKED_FILES_STORE, 'readonly');
    const req = tx.objectStore(TRACKED_FILES_STORE).getAll();
    req.onsuccess = () => r(new Set(req.result.map((i: any) => i.id)));
  });
};

// --- AUTH SCREEN ---

const LandingScreen = ({ onLogin, isDark }: { onLogin: (user: User) => void, isDark: boolean }) => {
  const [view, setView] = useState<AuthView>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const validateGmail = (e: string) => e.toLowerCase().endsWith('@gmail.com');

  const handleGoogleLogin = () => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.access_token) {
          fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` }
          })
          .then(res => res.json())
          .then(data => {
            onLogin({
              id: data.sub,
              email: data.email,
              name: data.name,
              accessToken: response.access_token
            });
          });
        }
      },
    });
    client.requestAccessToken();
  };

  const handleEmailAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateGmail(email)) {
      setError('LuminaGalaxy requires a verified Gmail account.');
      return;
    }
    // In this simulation, we proceed to Google OAuth anyway as per requirement 
    // that email login still links to a Google account.
    handleGoogleLogin();
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center p-6 ${isDark ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-900'}`}>
      <div className="absolute inset-0 overflow-hidden opacity-30 pointer-events-none">
         <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/20 blur-[120px] rounded-full" />
         <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/20 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-lg glass rounded-[40px] p-10 md:p-16 text-center shadow-2xl animate-in zoom-in-95">
        <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-3xl mx-auto mb-8 flex items-center justify-center text-white text-4xl font-black shadow-lg">L</div>
        
        {view === 'landing' && (
          <div className="space-y-8">
            <h1 className="text-5xl font-black tracking-tight leading-tight">Your Universe <br/> of Memories.</h1>
            <p className="text-zinc-400 text-lg">Securely store and sync your media directly to your Google Drive.</p>
            <button onClick={() => setView('options')} className="w-full bg-white text-zinc-950 py-5 rounded-2xl font-bold text-xl hover:scale-[1.02] transition-all shadow-xl">Get Started</button>
          </div>
        )}

        {view === 'options' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-8">Sign in to LuminaGalaxy</h2>
            <button onClick={handleGoogleLogin} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-blue-700 transition-all">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.92 3.32-2.12 4.4-.8.72-1.88 1.4-3.64 1.76-1.56.32-3.24.16-4.64-.44-1.4-.6-2.52-1.72-3.12-3.12s-.76-3.08-.44-4.64c.36-1.76 1.04-2.84 1.76-3.64 1.08-1.2 2.56-1.88 4.4-2.12v3.28h-3.28v2.12h3.28v3.28h2.12v-3.28h3.28v-2.12h-3.28v-3.28h-2.12v3.28h-3.28v2.12h3.28v3.28h2.12v-3.28h3.28v-2.12h-3.28V4.28c4.64.24 8.28 4.08 8.28 8.72 0 4.84-3.92 8.76-8.76 8.76s-8.76-3.92-8.76-8.76c0-4.64 3.64-8.48 8.28-8.72V4.28c-6.12.24-11 5.24-11 11.36s4.88 11.12 11 11.36v-6.08h-2.12V18.8c.68.2 1.4.32 2.12.32 3.96 0 7.16-3.2 7.16-7.16s-3.2-7.16-7.16-7.16c-.72 0-1.44.12-2.12.32V3.08h2.12z"/></svg>
              Sign in with Google
            </button>
            <button onClick={() => setView('email-signin')} className="w-full bg-zinc-800 text-white py-4 rounded-2xl font-bold hover:bg-zinc-700 transition-all">Continue with Email</button>
            <p className="text-zinc-500 text-sm pt-4">Don't have an account? <button onClick={() => setView('email-signup')} className="text-blue-500 font-bold">Sign up</button></p>
          </div>
        )}

        {(view === 'email-signin' || view === 'email-signup') && (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <h2 className="text-2xl font-bold mb-6">{view === 'email-signin' ? 'Welcome Back' : 'Create Gmail Account'}</h2>
            <input 
              type="email" 
              placeholder="Gmail Address" 
              required 
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
            />
            <input 
              type="password" 
              placeholder="Password" 
              required 
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
            <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold">Continue</button>
            <button type="button" onClick={() => setView('options')} className="text-zinc-500 text-sm">Back to options</button>
          </form>
        )}
      </div>
    </div>
  );
};

// --- MAIN APP ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('photos');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(true);

  // Initialize GAPI
  useEffect(() => {
    const initGapi = () => {
      (window as any).gapi.load('client', async () => {
        await (window as any).gapi.client.init({
          discoveryDocs: DISCOVERY_DOCS,
        });
        setIsInitializing(false);
      });
    };
    initGapi();
  }, []);

  // Fetch Media from Drive and Filter by Local Metadata
  const syncWithDrive = async (user: User) => {
    if (!user.accessToken) return;
    (window as any).gapi.client.setToken({ access_token: user.accessToken });
    
    try {
      // 1. Find or create app folder
      let folderId = user.driveFolderId;
      if (!folderId) {
        const folderRes = await (window as any).gapi.client.drive.files.list({
          q: `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id)',
        });
        if (folderRes.result.files.length > 0) {
          folderId = folderRes.result.files[0].id;
        } else {
          const createRes = await (window as any).gapi.client.drive.files.create({
            resource: { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
            fields: 'id',
          });
          folderId = createRes.result.id;
        }
        setCurrentUser(prev => prev ? { ...prev, driveFolderId: folderId } : null);
      }

      // 2. Fetch all files in folder
      const fileRes = await (window as any).gapi.client.drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, webContentLink, thumbnailLink, createdTime)',
      });

      // 3. Filter by local tracked ID database
      const trackedIds = await getTrackedFileIds();
      const driveFiles = fileRes.result.files || [];
      
      const appFiles: MediaItem[] = driveFiles
        .filter((file: any) => trackedIds.has(file.id))
        .map((file: any) => ({
          id: file.id,
          userId: user.id,
          type: file.mimeType.startsWith('video/') ? MediaType.VIDEO : MediaType.IMAGE,
          url: file.thumbnailLink?.replace('=s220', '=s1000') || file.webContentLink,
          title: file.name,
          description: `Uploaded to Google Drive`,
          timestamp: new Date(file.createdTime).getTime()
        }));

      setMedia(appFiles);
    } catch (e) {
      console.error("Sync error", e);
    }
  };

  useEffect(() => {
    if (currentUser) syncWithDrive(currentUser);
  }, [currentUser]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !currentUser?.driveFolderId) return;
    setIsProcessing(true);
    // Fix: Cast e.target.files to File[] to prevent 'unknown' type errors during iteration.
    const files = Array.from(e.target.files) as File[];

    for (const file of files) {
      const metadata = {
        name: file.name,
        parents: [currentUser.driveFolderId]
      };
      
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', file);

      try {
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentUser.accessToken}` },
          body: formData
        });
        const data = await res.json();
        
        const newItem: MediaItem = {
          id: data.id,
          userId: currentUser.id,
          type: file.type.startsWith('video/') ? MediaType.VIDEO : MediaType.IMAGE,
          url: '', // Will be updated on sync
          title: file.name,
          description: 'Uploaded to LuminaGalaxy',
          timestamp: Date.now()
        };

        await trackFile(newItem);
      } catch (err) {
        console.error("Upload failed", err);
      }
    }
    
    await syncWithDrive(currentUser);
    setIsProcessing(false);
  };

  const deleteItem = async (id: string) => {
    if (!currentUser?.accessToken) return;
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentUser.accessToken}` }
      });
      await untrackFile(id);
      setMedia(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  if (isInitializing) return (
    <div className="fixed inset-0 flex items-center justify-center bg-zinc-950">
      <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  if (!currentUser) return <LandingScreen onLogin={setCurrentUser} isDark={darkMode} />;

  const filteredMedia = media.filter(m => {
    const matchesView = currentView === 'photos' ? m.type === MediaType.IMAGE : m.type === MediaType.VIDEO;
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesView && matchesSearch;
  });

  return (
    <div className={`h-screen flex flex-col md:flex-row overflow-hidden transition-colors ${darkMode ? 'bg-zinc-950 text-white' : 'bg-zinc-50 text-zinc-900'}`}>
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass md:relative md:w-24 md:flex-shrink-0 flex flex-row md:flex-col items-center justify-around py-4">
        <div className="hidden md:block w-12 h-12 bg-white text-black rounded-2xl flex items-center justify-center font-bold text-xl mb-12 shadow-lg">L</div>
        <button onClick={() => setCurrentView('photos')} className={`p-4 rounded-2xl ${currentView === 'photos' ? 'bg-white text-black shadow-xl' : 'text-zinc-500'}`}><ImageIcon className="w-7 h-7"/></button>
        <button onClick={() => setCurrentView('videos')} className={`p-4 rounded-2xl ${currentView === 'videos' ? 'bg-white text-black shadow-xl' : 'text-zinc-500'}`}><VideoIcon className="w-7 h-7"/></button>
        <button onClick={() => setCurrentView('upload')} className={`p-4 rounded-2xl ${currentView === 'upload' ? 'bg-white text-black shadow-xl' : 'text-zinc-500'}`}><UploadIcon className="w-7 h-7"/></button>
        <div className="md:mt-auto flex md:flex-col gap-4">
          <button onClick={() => setDarkMode(!darkMode)} className="p-4 text-zinc-500">{darkMode ? <SunIcon/> : <MoonIcon/>}</button>
          <button onClick={() => setCurrentUser(null)} className="p-4 text-red-500"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg></button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-6 md:p-12 pb-24 md:pb-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black capitalize">{currentView}</h1>
            <p className="text-zinc-500 font-medium mt-2">{currentUser.email} • Connected to Drive</p>
          </div>
          <div className="relative w-full md:w-80 group">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5"/>
            <input 
              type="text" 
              placeholder="Search your Galaxy..." 
              className={`w-full py-4 pl-12 pr-4 rounded-2xl outline-none border transition-all ${darkMode ? 'bg-zinc-900 border-zinc-800 focus:border-zinc-600' : 'bg-white border-zinc-200 focus:border-zinc-400'}`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </header>

        {currentView === 'upload' ? (
          <div className={`border-4 border-dashed rounded-[40px] p-20 text-center transition-all ${isProcessing ? 'opacity-50 pointer-events-none' : 'hover:scale-[1.01]'} ${darkMode ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-white shadow-sm'}`}>
            <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6"><UploadIcon className="w-10 h-10 text-zinc-400"/></div>
            <h2 className="text-2xl font-bold mb-4">Space Storage Ready</h2>
            <p className="text-zinc-500 mb-8 max-w-sm mx-auto">Upload files directly to your private Google Drive folder.</p>
            <label className="bg-white text-black px-10 py-5 rounded-2xl font-black text-lg cursor-pointer hover:bg-zinc-200 transition-colors inline-block shadow-xl">
              {isProcessing ? 'Syncing to Drive...' : 'Select Files'}
              <input type="file" multiple className="hidden" onChange={handleFileUpload} accept="image/*,video/*"/>
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredMedia.length > 0 ? filteredMedia.map(item => (
              <div key={item.id} className="group relative aspect-square rounded-3xl overflow-hidden bg-zinc-800 shadow-lg cursor-pointer">
                {item.type === MediaType.IMAGE ? (
                  <img src={item.url} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                    <VideoIcon className="w-12 h-12 text-zinc-700"/>
                    <div className="absolute top-4 right-4 bg-black/40 p-2 rounded-xl backdrop-blur-md"><VideoIcon className="w-4 h-4 text-white"/></div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                  <div className="flex justify-between items-center">
                    <button onClick={() => deleteItem(item.id)} className="bg-red-500 p-3 rounded-xl hover:bg-red-600 transition-colors"><TrashIcon className="w-5 h-5 text-white"/></button>
                    <a href={item.url} target="_blank" className="bg-white/20 p-3 rounded-xl backdrop-blur-md hover:bg-white/30 transition-colors"><ExpandIcon className="w-5 h-5 text-white"/></a>
                  </div>
                </div>
              </div>
            )) : (
              <div className="col-span-full py-20 text-center opacity-30">
                <SearchIcon className="w-16 h-16 mx-auto mb-4"/>
                <p className="text-xl font-medium">No files found in your galaxy.</p>
              </div>
            )}
          </div>
        )}
      </main>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLES }} />
    </div>
  );
}
