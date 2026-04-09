import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, VideoOff } from 'lucide-react';

import type { StreamManager, Subscriber } from '@mediaserver/media-client';

export interface StreamState {
  id: string;
  mediaStream?: MediaStream | null;
  subscriber?: Subscriber | StreamManager | null;
  participantId: string;
  metadata?: string;
}

interface Props {
  stream: StreamState;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const CameraView: React.FC<Props> = ({ stream, isExpanded, onToggleExpand }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let nativeVideo = videoRef.current;
    if (!nativeVideo) return;

    const handlePlaying = () => {
      console.log(`[CameraView] Stream is now playing: ${stream.id}`);
      setIsPlaying(true);
    };

    if (stream.subscriber) {
      console.log(`[CameraView] Initializing via Subscriber for: ${stream.id}`);
      stream.subscriber.addVideoElement(nativeVideo);

      stream.subscriber.on('streamPlaying', handlePlaying);

      nativeVideo.addEventListener('playing', handlePlaying);

      return () => {
        if (stream.subscriber) {
          stream.subscriber.off('streamPlaying', handlePlaying);
        }
        if (nativeVideo) nativeVideo.removeEventListener('playing', handlePlaying);
      };
    } else if (stream.mediaStream) {
      console.log(`[CameraView] Initializing via MediaStream for: ${stream.id}`);
      nativeVideo.srcObject = stream.mediaStream;
      nativeVideo.addEventListener('playing', handlePlaying);

      return () => {
        if (nativeVideo) nativeVideo.removeEventListener('playing', handlePlaying);
      };
    }
  }, [stream.subscriber, stream.mediaStream, stream.id]);

  // Try to parse metadata if it's JSON
  let cameraName = stream.participantId;
  try {
    const meta = JSON.parse(stream.metadata || '{}');
    if (meta.clientData) cameraName = meta.clientData;
  } catch (e) {
    // ignore
  }

  return (
    <div className={`relative group overflow-hidden rounded-xl bg-slate-900 border border-white/10 transition-all duration-300 animate-fade-in ${isExpanded ? 'col-span-full row-span-2' : ''}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover aspect-video"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-white drop-shadow-md">
              {cameraName}
            </span>
          </div>

          <button
            onClick={onToggleExpand}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-md transition-colors text-white"
          >
            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {!isPlaying && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-800">
          <VideoOff size={48} className="text-slate-600 animate-pulse" />
          <span className="text-slate-500 text-sm italic">Подключение к потоку...</span>
        </div>
      )}
    </div>
  );
};
