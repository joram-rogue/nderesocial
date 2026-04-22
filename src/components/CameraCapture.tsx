import { useEffect, useRef, useState } from "react";
import { X, Camera, Video, RefreshCw, Check, Circle, Square } from "lucide-react";
import { toast } from "sonner";

type Mode = "photo" | "video";

export const CameraCapture = ({
  onCapture, onClose,
}: { onCapture: (file: File) => void; onClose: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [mode, setMode] = useState<Mode>("photo");
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);

  const start = async () => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 3840 }, height: { ideal: 2160 } },
        audio: mode === "video",
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    } catch (e: any) {
      toast.error(e.message || "Camera access denied");
      onClose();
    }
  };

  useEffect(() => { start(); return () => streamRef.current?.getTracks().forEach((t) => t.stop()); // eslint-disable-next-line
  }, [facing, mode]);

  const snap = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      setPreview({ url: URL.createObjectURL(blob), file });
    }, "image/jpeg", 0.95);
  };

  const toggleRec = () => {
    if (!streamRef.current) return;
    if (!recording) {
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      const rec = new MediaRecorder(streamRef.current, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const file = new File([blob], `capture-${Date.now()}.webm`, { type: "video/webm" });
        setPreview({ url: URL.createObjectURL(blob), file });
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } else {
      recorderRef.current?.stop();
      setRecording(false);
    }
  };

  const accept = () => { if (preview) { onCapture(preview.file); onClose(); } };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 inset-x-0 z-10 p-4 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent">
        <button onClick={onClose} className="p-2.5 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-white">
          <X className="w-5 h-5" />
        </button>
        <div className="flex gap-1 p-1 rounded-full bg-white/5 backdrop-blur-xl border border-white/10">
          {(["photo", "video"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-wider font-semibold transition-all ${mode === m ? "bg-white text-black" : "text-white/70"}`}>
              {m}
            </button>
          ))}
        </div>
        <button onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          className="p-2.5 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-white">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Viewfinder / Preview */}
      <div className="flex-1 relative overflow-hidden">
        {preview ? (
          preview.file.type.startsWith("video") ? (
            <video src={preview.url} className="absolute inset-0 w-full h-full object-contain" controls autoPlay />
          ) : (
            <img src={preview.url} alt="" className="absolute inset-0 w-full h-full object-contain" />
          )
        ) : (
          <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 inset-x-0 p-8 pb-12 flex items-center justify-center gap-10 bg-gradient-to-t from-black/80 to-transparent">
        {preview ? (
          <>
            <button onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}
              className="p-4 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-white">
              <X className="w-6 h-6" />
            </button>
            <button onClick={accept}
              className="p-5 rounded-full bg-white text-black shadow-2xl">
              <Check className="w-7 h-7" />
            </button>
          </>
        ) : mode === "photo" ? (
          <button onClick={snap} className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl border-4 border-white grid place-items-center active:scale-95 transition-transform">
            <Camera className="w-7 h-7 text-white" />
          </button>
        ) : (
          <button onClick={toggleRec}
            className={`w-20 h-20 rounded-full backdrop-blur-xl border-4 border-white grid place-items-center active:scale-95 transition-transform ${recording ? "bg-red-500/30" : "bg-white/10"}`}>
            {recording ? <Square className="w-7 h-7 text-red-500 fill-red-500" /> : <Circle className="w-7 h-7 text-red-500 fill-red-500" />}
          </button>
        )}
      </div>
    </div>
  );
};
