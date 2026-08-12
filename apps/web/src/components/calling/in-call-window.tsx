'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LiveKitRoom, VideoConference, useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import type { LocalVideoTrack } from 'livekit-client';
import { BackgroundProcessor, supportsModernBackgroundProcessors } from '@livekit/track-processors';
import { Sparkles } from 'lucide-react';

interface Props {
  url: string;
  token: string;
  video: boolean;
  peerName: string;
  onLeave: () => void;
}

/** Same-origin branded backdrop applied as the default virtual background. */
const BG_IMAGE = '/zedtreeo-call-bg.svg';
/**
 * Self-hosted MediaPipe assets (copied into public/ at build) — no CDN
 * dependency. The landscape segmenter is tuned for 16:9 webcam frames and
 * gives noticeably steadier edges than the square default model.
 */
const MEDIAPIPE_ASSETS = {
  tasksVisionFileSet: '/mediapipe/wasm',
  modelAssetPath: '/mediapipe/selfie_segmenter_landscape.tflite',
};

type BgStatus = 'idle' | 'applying' | 'on' | 'off' | 'unavailable';

/**
 * Applies (or removes) the Zedtreeo virtual background on the local camera
 * track and reports what actually happened, so the toggle never claims a
 * background that failed to load. Re-runs whenever the camera (re)publishes
 * or the toggle changes.
 */
function VirtualBackgroundController({
  enabled, onStatus,
}: { enabled: boolean; onStatus: (s: BgStatus) => void }) {
  const { cameraTrack } = useLocalParticipant();

  useEffect(() => {
    const track = cameraTrack?.track as LocalVideoTrack | undefined;
    if (!track) { onStatus('idle'); return; }
    if (enabled && !supportsModernBackgroundProcessors()) {
      onStatus('unavailable');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (enabled) {
          if (!track.getProcessor()) {
            onStatus('applying');
            const processor = BackgroundProcessor({
              mode: 'virtual-background',
              imagePath: BG_IMAGE,
              assetPaths: MEDIAPIPE_ASSETS,
            });
            if (!cancelled) await track.setProcessor(processor);
          }
          if (!cancelled) onStatus('on');
        } else {
          if (track.getProcessor()) await track.stopProcessor();
          if (!cancelled) onStatus('off');
        }
      } catch (err) {
        // Segmentation failed → raw camera, and say so instead of pretending.
        console.error('[virtual-background] failed:', err);
        if (!cancelled) onStatus('unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, cameraTrack, onStatus]);

  return null;
}

/**
 * The background toggle, camera-aware: shows whenever the local camera is on
 * (including a camera turned on mid-way through an audio call).
 */
function BackgroundToggle({
  bgOn, status, onToggle,
}: { bgOn: boolean; status: BgStatus; onToggle: () => void }) {
  const { isCameraEnabled } = useLocalParticipant();
  if (!isCameraEnabled) return null;

  const label =
    status === 'unavailable' ? 'Background unavailable'
    : status === 'applying' ? 'Applying background…'
    : bgOn ? 'Background: On' : 'Background: Off';

  return (
    <button
      onClick={onToggle}
      disabled={status === 'unavailable' || status === 'applying'}
      title="Toggle Zedtreeo background"
      className="absolute top-4 right-4 z-[210] flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white bg-black/50 hover:bg-black/70 backdrop-blur transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <Sparkles size={16} className={bgOn && status === 'on' ? 'text-brand-300' : 'text-white/70'} />
      {label}
    </button>
  );
}

/**
 * Full-screen 1:1 or group call window. LiveKit's <VideoConference> gives the
 * tile grid + control bar (mute, camera, screen share, leave). The Zedtreeo
 * virtual background is on by default for video calls and can be toggled off;
 * it also works when a camera is turned on during an audio call.
 */
export function InCallWindow({ url, token, video, onLeave }: Props) {
  const [bgOn, setBgOn] = useState(video);
  const [bgStatus, setBgStatus] = useState<BgStatus>('idle');
  const startVideo = useRef(video).current;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black"
      data-lk-theme="default"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <LiveKitRoom
        serverUrl={url}
        token={token}
        connect
        audio
        video={startVideo}
        onDisconnected={onLeave}
        style={{ height: '100%' }}
      >
        <VideoConference />
        <VirtualBackgroundController enabled={bgOn} onStatus={setBgStatus} />
        <BackgroundToggle bgOn={bgOn} status={bgStatus} onToggle={() => setBgOn((v) => !v)} />
      </LiveKitRoom>
    </div>
  );
}
