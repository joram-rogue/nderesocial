import { useCallback, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { X, Check, Crop as CropIcon, Sliders, Sparkles, RotateCcw } from "lucide-react";
import { FILTER_PRESETS, buildAdjustCss, composeCss } from "@/lib/filters";

type Tab = "filters" | "crop" | "adjust";

const ASPECTS = [
  { id: "9:16", label: "9:16", value: 9 / 16 },
  { id: "1:1",  label: "1:1",  value: 1 },
  { id: "4:5",  label: "4:5",  value: 4 / 5 },
  { id: "free", label: "Free", value: undefined as number | undefined },
];

export type EditorResult = {
  file: File;
  filterCss: string; // for videos: persisted to apply at playback
};

export const MediaEditor = ({
  source, onCancel, onDone,
}: { source: { file: File; url: string }; onCancel: () => void; onDone: (r: EditorResult) => void }) => {
  const isVideo = source.file.type.startsWith("video");
  const [tab, setTab] = useState<Tab>("filters");
  const [presetId, setPresetId] = useState("none");
  const [adjust, setAdjust] = useState({ brightness: 1, contrast: 1, saturate: 1 });

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(9 / 16);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const preset = FILTER_PRESETS.find((p) => p.id === presetId)!;
  const filterCss = composeCss(preset.css, buildAdjustCss(adjust));

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  const reset = () => {
    setPresetId("none");
    setAdjust({ brightness: 1, contrast: 1, saturate: 1 });
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  };

  // Bake photo: apply crop + filter through canvas → JPEG
  const bakePhoto = async (): Promise<File> => {
    const img = await loadImage(source.url);
    const area = croppedArea ?? { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(area.width);
    canvas.height = Math.round(area.height);
    const ctx = canvas.getContext("2d")!;
    ctx.filter = filterCss === "none" ? "none" : filterCss;
    ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.92));
    return new File([blob], `edited-${Date.now()}.jpg`, { type: "image/jpeg" });
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (isVideo) {
        // Browser can't reliably re-encode video on a phone; persist filter for playback.
        // Crop is also skipped for video here — keep it simple and fast.
        onDone({ file: source.file, filterCss });
      } else {
        const file = await bakePhoto();
        onDone({ file, filterCss: "none" });
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <button onClick={onCancel} className="p-2 rounded-full bg-white/10"><X className="w-5 h-5" /></button>
        <span className="text-sm font-semibold">Edit</span>
        <Button
          onClick={submit}
          disabled={busy}
          className="bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-full px-5 gap-2"
        >
          <Check className="w-4 h-4" /> Done
        </Button>
      </div>

      {/* Stage */}
      <div className="flex-1 relative bg-black overflow-hidden">
        {isVideo ? (
          <video
            src={source.url}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ filter: filterCss }}
            autoPlay loop muted playsInline
          />
        ) : tab === "crop" ? (
          <Cropper
            image={source.url}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid
            objectFit="contain"
            style={{
              containerStyle: { background: "#000" },
              mediaStyle: { filter: filterCss },
            }}
          />
        ) : (
          <img
            src={source.url}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            style={{ filter: filterCss }}
          />
        )}
      </div>

      {/* Tab content */}
      <div className="bg-black/95 backdrop-blur-xl border-t border-white/10">
        {tab === "filters" && (
          <div className="p-3 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 min-w-max">
              {FILTER_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPresetId(p.id)}
                  className={`flex flex-col items-center gap-1.5 transition-transform ${presetId === p.id ? "scale-105" : "opacity-80"}`}
                >
                  <div className={`w-16 h-16 rounded-xl overflow-hidden border-2 ${presetId === p.id ? "border-primary" : "border-white/10"}`}>
                    {isVideo ? (
                      <div className="w-full h-full bg-gradient-to-br from-primary/40 to-accent/40" style={{ filter: p.css === "none" ? "none" : p.css }} />
                    ) : (
                      <img src={source.url} alt="" className="w-full h-full object-cover" style={{ filter: p.css === "none" ? "none" : p.css }} />
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-white/80">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "crop" && !isVideo && (
          <div className="p-4 space-y-3">
            <div className="flex gap-2 justify-center">
              {ASPECTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAspect(a.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${aspect === a.value ? "bg-white text-black" : "bg-white/10 text-white"}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-white/70"><span>Zoom</span><span>{zoom.toFixed(2)}×</span></div>
              <Slider value={[zoom]} min={1} max={3} step={0.01} onValueChange={(v) => setZoom(v[0])} />
            </div>
          </div>
        )}

        {tab === "crop" && isVideo && (
          <div className="p-6 text-center text-xs text-white/70">
            Cropping video isn't supported on-device. Use Filters & Adjust for now.
          </div>
        )}

        {tab === "adjust" && (
          <div className="p-4 space-y-4">
            {([
              { key: "brightness", label: "Brightness", min: 0.5, max: 1.5 },
              { key: "contrast",   label: "Contrast",   min: 0.5, max: 1.5 },
              { key: "saturate",   label: "Saturation", min: 0,   max: 2   },
            ] as const).map((s) => (
              <div key={s.key} className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-white/70">
                  <span>{s.label}</span>
                  <span>{adjust[s.key].toFixed(2)}</span>
                </div>
                <Slider
                  value={[adjust[s.key]]}
                  min={s.min}
                  max={s.max}
                  step={0.01}
                  onValueChange={(v) => setAdjust({ ...adjust, [s.key]: v[0] })}
                />
              </div>
            ))}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex items-center justify-around border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
          {([
            { id: "filters", label: "Filters", Icon: Sparkles },
            { id: "crop",    label: "Crop",    Icon: CropIcon },
            { id: "adjust",  label: "Adjust",  Icon: Sliders },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] uppercase tracking-wider ${tab === id ? "text-primary" : "text-white/60"}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
          <button onClick={reset} className="px-4 py-3 text-white/60" aria-label="Reset">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
