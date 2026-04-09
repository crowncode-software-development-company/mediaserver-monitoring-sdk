import React, { useState, useEffect, useRef } from 'react';
import { Network, LogOut, Video, Activity, Globe, Shield, RefreshCw } from 'lucide-react';
import { CameraView, StreamState } from './components/CameraView';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Session, MediaClient } from '@mediaserver/media-client';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function App() {
  const [token, setToken] = useState('');
  const [connected, setConnected] = useState(false);
  const [streams, setStreams] = useState<StreamState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const mediaClient = useRef<MediaClient | null>(null);
  const session = useRef<Session | null>(null);

  useEffect(() => {
    return () => {
      if (session.current) {
        session.current.disconnect();
      }
    };
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError(null);
    setIsLoading(true);

    try {
      mediaClient.current = new MediaClient();

      // Настройка расширенной конфигурации для стабильного WebRTC
      mediaClient.current.setConfiguration({
        // iceServers: [
        //     { urls: 'stun:stun.l.google.com:19302' },
        //     { urls: 'stun:stun1.l.google.com:19302' },
        //     { urls: 'stun:stun2.l.google.com:19302' }
        // ]
      });

      session.current = mediaClient.current.initSession();
      session.current.on("reconnected", (event) => {
        console.log("[MediaClient] Reconnected to session", event);
      })
      session.current.on("reconnecting", (event) => {
        console.log("[MediaClient] Reconnecting to session", event);
      })
      session.current.on("streamDestroyed", (event) => {
        console.log("[MediaClient] Stream destroyed", event);
      })
      session.current.on("signal", (event) => {
        console.log("[MediaClient] Signal received", event);
      })

      session.current.on("streamCreated", (event) => {
        console.log("[MediaClient] Stream created:", event.stream.streamId);

        // Подписываемся на поток
        const subscriber = session.current!.subscribe(event.stream, undefined);

        subscriber.on('streamPlaying', () => {
          console.log("[MediaClient] Stream is playing:", event.stream.streamId);
        });

        subscriber.on('error', (err) => {
          console.error("[MediaClient] Subscriber error for " + event.stream.streamId + ":", err);
        });

        setStreams(prev => {
          if (prev.find(s => s.id === event.stream.streamId)) return prev;
          return [...prev, {
            id: event.stream.streamId,
            subscriber: subscriber,
            mediaStream: null,
            participantId: event.stream.connection.connectionId,
            metadata: event.stream.connection.data
          }];
        });
      });

      session.current.on('streamDestroyed', (event) => {
        setStreams(prev => prev.filter(s => s.id !== event.stream.streamId));
      });

      session.current.on('exception', (exception) => {
        console.error("exception:", exception);
      });

      await session.current.connect(token);
      setConnected(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Не удалось подключиться к узлу трансляции');
      if (session.current) {
        session.current.disconnect();
      }
      setConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    if (session.current) {
      session.current.disconnect();
    }
    mediaClient.current = null;
    session.current = null;
    setConnected(false);
    setStreams([]);
    setToken('');
  };

  return (
    <div className="min-h-screen w-full bg-[#0f172a] text-slate-200">
      <nav className="border-b border-white/5 bg-white/5 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Video className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">MediaServer <span className="text-blue-400">Panel</span></h1>
            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">Core Stream Engine</p>
          </div>
        </div>

        {connected ? (
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 px-4 py-2 rounded-full bg-slate-800/50 border border-white/5">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-blue-400" />
                <span className="text-xs font-semibold uppercase">{streams.length} Потоков</span>
              </div>
              <div className="w-px h-3 bg-white/10" />
              <div className="flex items-center gap-2 text-emerald-400">
                <Globe size={14} />
                <span className="text-xs font-semibold uppercase">Узел активен</span>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-bold transition-all border border-red-500/20"
            >
              <LogOut size={18} />
              <span>Выйти</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-sm font-medium text-slate-400">{isLoading ? 'Инициализация...' : 'Система готова'}</span>
          </div>
        )}
      </nav>

      <main className="container mx-auto px-6 py-10">
        {!connected ? (
          <div className="max-w-xl mx-auto space-y-8">
            <div className="text-center space-y-3">
              <h2 className="text-4xl font-extrabold text-white tracking-tight">Вход в систему</h2>
              <p className="text-slate-400 text-lg">Используйте токен для доступа к медиа-узлу.</p>
            </div>

            <form onSubmit={handleConnect} className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative bg-slate-800/80 border border-white/10 backdrop-blur-2xl p-8 rounded-2xl shadow-2xl space-y-6">
                <div className="space-y-2">
                  <label htmlFor="token" className="block text-sm font-bold text-slate-300 ml-1">Токен соединения</label>
                  <div className="relative">
                    <input
                      id="token"
                      type="text"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="wss://media.example.com/node?token=..."
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-5 py-4 pl-12 text-blue-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono text-sm"
                    />
                    <Network className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                  </div>
                </div>

                {error && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
                    <Activity size={18} className="shrink-0 mt-0.5" />
                    <p className="font-medium">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !token}
                  className={cn(
                    "w-full py-4 rounded-xl text-white font-black text-lg transition-all shadow-xl flex items-center justify-center gap-3",
                    isLoading || !token
                      ? "bg-slate-700 cursor-not-allowed text-slate-400"
                      : "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
                  )}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="animate-spin" size={22} />
                      <span>Подключение...</span>
                    </>
                  ) : (
                    <>
                      <Activity size={22} />
                      <span>Подключиться</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-white leading-tight">Мониторинг камер</h2>
                <p className="text-slate-400 font-bold mt-1 uppercase tracking-wide text-xs">Активных потоков: {streams.length}</p>
              </div>
            </div>

            {streams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 rounded-3xl bg-slate-800/30 border-2 border-dashed border-white/5 text-slate-500 space-y-4">
                <Video size={64} className="opacity-20 translate-y-2 animate-pulse" />
                <p className="text-xl font-bold italic tracking-tight opacity-40">Ожидание входящих потоков...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {streams.map((stream) => (
                  <CameraView
                    key={stream.id}
                    stream={stream}
                    isExpanded={expandedId === stream.id}
                    onToggleExpand={() => setExpandedId(expandedId === stream.id ? null : stream.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-10 text-center border-t border-white/5 mt-auto">
        <p className="text-slate-600 text-xs font-black uppercase tracking-widest">© 2026 MediaServer Control Panel </p>
      </footer>
    </div>
  );
}

export default App;
