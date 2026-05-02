import { useRef } from "react";
import { useTheme, WALLPAPER_PRESETS, wallpaperCss } from "@/hooks/useTheme";
import { X, Upload, Check, Sun, Moon, Type } from "lucide-react";
import { toast } from "sonner";

export const ThemeSettings = ({ onClose }: { onClose: () => void }) => {
  const { theme, setTheme, fontMode, setFontMode, wallpaper, setWallpaper } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const onUpload = (f: File) => {
    if (f.size > 4 * 1024 * 1024) { toast.error("Pick an image under 4MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setWallpaper(String(reader.result));
    reader.readAsDataURL(f);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-end sm:place-items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto glass-strong rounded-t-3xl sm:rounded-3xl p-5 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">Theme & wallpaper</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <section className="mb-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Theme</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setTheme("coffee")}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold ${theme === "coffee" ? "bg-primary text-primary-foreground" : "glass"}`}>
              <Sun className="w-4 h-4" /> Coffee
            </button>
            <button onClick={() => setTheme("midnight")}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold ${theme === "midnight" ? "bg-primary text-primary-foreground" : "glass"}`}>
              <Moon className="w-4 h-4" /> Midnight
            </button>
          </div>
        </section>

        <section className="mb-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Type className="w-3.5 h-3.5" /> Font</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setFontMode("app")}
              className={`py-3 rounded-2xl text-sm font-semibold ${fontMode === "app" ? "bg-primary text-primary-foreground" : "glass"}`}>
              App font
            </button>
            <button onClick={() => setFontMode("system")}
              className={`py-3 rounded-2xl text-sm font-semibold ${fontMode === "system" ? "bg-primary text-primary-foreground" : "glass"}`}
              style={{ fontFamily: "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" }}>
              Phone default
            </button>
          </div>
        </section>

        <section>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Chat wallpaper</p>
          <div className="grid grid-cols-3 gap-2">
            {WALLPAPER_PRESETS.map((p) => {
              const active = wallpaper === p.id;
              return (
                <button key={p.id || "none"} onClick={() => setWallpaper(p.id)}
                  className={`relative aspect-square rounded-2xl overflow-hidden border ${active ? "border-primary ring-2 ring-primary" : "border-border/40"}`}
                  style={{ background: p.css || "hsl(var(--muted))" }}>
                  {!p.css && <span className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">None</span>}
                  {active && <Check className="absolute top-1 right-1 w-4 h-4 text-primary-foreground bg-primary rounded-full p-0.5" />}
                  <span className="absolute bottom-1 left-1.5 text-[10px] uppercase tracking-wider text-white/80 font-semibold drop-shadow">{p.label}</span>
                </button>
              );
            })}
            <button onClick={() => fileRef.current?.click()}
              className="aspect-square rounded-2xl border border-dashed border-border/60 grid place-items-center text-muted-foreground hover:text-primary hover:border-primary transition-colors">
              <Upload className="w-5 h-5" />
            </button>
          </div>
          {wallpaper && wallpaper.startsWith("data:") && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-border/40 h-24" style={{ background: wallpaperCss(wallpaper) }} />
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          {wallpaper && (
            <button onClick={() => setWallpaper("")} className="mt-3 w-full py-2 rounded-xl text-sm glass hover:bg-destructive/10 hover:text-destructive">
              Clear wallpaper
            </button>
          )}
        </section>
      </div>
    </div>
  );
};
