import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2 } from "lucide-react";

type Props = {
  src: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Autoplay when this fraction of the player is visible. Set 0 to disable. */
  autoPlayOnVisible?: number;
  /** Loop playback (great for short reels). */
  loop?: boolean;
  /** Start muted (required for browser autoplay). */
  defaultMuted?: boolean;
  /** object-contain (default) or object-cover. */
  fit?: "contain" | "cover";
  /** Background color around the video. */
  bg?: string;
};

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
};

/**
 * Lightweight native <video> wrapper with custom Reels-style controls.
 * - Tap to play/pause
 * - IntersectionObserver autoplay (muted) when in view, pause when out
 * - Scrubber, time, mute, fullscreen
 * - Shows a brief play/pause icon flash on tap
 */
export const NativeVideo = ({
  src,
  poster,
  className = "",
  style,
  autoPlayOnVisible = 0.6,
  loop = true,
  defaultMuted = true,
  fit = "contain",
  bg = "black",
}: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(defaultMuted);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [flash, setFlash] = useState<"play" | "pause" | null>(null);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<number | null>(null);

  const bumpControls = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShowControls(false), 2200);
  }, []);

  // Autoplay on visible
  useEffect(() => {
    if (!autoPlayOnVisible || !wrapRef.current) return;
    const v = videoRef.current;
    if (!v) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio >= autoPlayOnVisible) {
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        });
      },
      { threshold: [autoPlayOnVisible] }
    );
    obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, [autoPlayOnVisible]);

  // Pause when tab hidden
  useEffect(() => {
    const onVis = () => { if (document.hidden) videoRef.current?.pause(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setFlash("play");
    } else {
      v.pause();
      setFlash("pause");
    }
    setTimeout(() => setFlash(null), 350);
    bumpControls();
  };

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = (Number(e.target.value) / 100) * duration;
    bumpControls();
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    bumpControls();
  };

  const goFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v: any = videoRef.current;
    if (!v) return;
    (v.requestFullscreen?.() || v.webkitEnterFullscreen?.())?.catch?.(() => {});
  };

  const onTime = () => {
    const v = videoRef.current;
    if (!v) return;
    setTime(v.currentTime);
    if (v.buffered.length) {
      try { setBuffered(v.buffered.end(v.buffered.length - 1)); } catch {/* */}
    }
  };

  const pct = duration ? (time / duration) * 100 : 0;
  const bufPct = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={wrapRef}
      className={`relative w-full h-full select-none group ${className}`}
      style={{ background: bg, ...style }}
      onMouseMove={bumpControls}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        loop={loop}
        muted={muted}
        preload="metadata"
        onClick={toggle}
        onPlay={() => { setPlaying(true); bumpControls(); }}
        onPause={() => { setPlaying(false); bumpControls(); }}
        onTimeUpdate={onTime}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onProgress={onTime}
        className={`w-full h-full ${fit === "cover" ? "object-cover" : "object-contain"}`}
      />

      {/* Center play/pause flash */}
      {flash && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="w-20 h-20 rounded-full bg-black/55 backdrop-blur-md grid place-items-center animate-fade-in">
            {flash === "play" ? (
              <Play className="w-10 h-10 text-white fill-white" />
            ) : (
              <Pause className="w-10 h-10 text-white fill-white" />
            )}
          </div>
        </div>
      )}

      {/* Big tap-to-play overlay when paused */}
      {!playing && !flash && (
        <button
          onClick={toggle}
          className="absolute inset-0 grid place-items-center bg-black/20"
          aria-label="Play"
        >
          <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-md border border-white/20 grid place-items-center">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
        </button>
      )}

      {/* Bottom controls */}
      <div
        className={`absolute left-0 right-0 bottom-0 px-3 pb-2 pt-6 bg-gradient-to-t from-black/70 via-black/30 to-transparent transition-opacity duration-300 ${
          showControls || !playing ? "opacity-100" : "opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrubber */}
        <div className="relative h-1 mb-1.5">
          <div className="absolute inset-0 rounded-full bg-white/20" />
          <div className="absolute inset-y-0 left-0 rounded-full bg-white/40" style={{ width: `${bufPct}%` }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${pct}%` }} />
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={pct}
            onChange={onScrub}
            aria-label="Seek"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between gap-2 text-white text-[11px] font-medium tabular-nums">
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="p-1 rounded hover:bg-white/15" aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
            </button>
            <span>{fmt(time)} / {fmt(duration)}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleMute} className="p-1.5 rounded hover:bg-white/15" aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button onClick={goFullscreen} className="p-1.5 rounded hover:bg-white/15" aria-label="Fullscreen">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
