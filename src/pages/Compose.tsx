import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Image as ImageIcon, Film, X, Send, Camera, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { CameraCapture } from "@/components/CameraCapture";
import { notifyAllUsers } from "@/hooks/useNotifications";
import { NativeVideo } from "@/components/NativeVideo";
import { pickMedia } from "@/lib/mediaPicker";
import { Capacitor } from "@capacitor/core";

type Audience = "all" | "staff" | "troupe";

export default function Compose() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (!loading && !user) navigate("/auth", { replace: true }); }, [user, loading, navigate]);

  const audienceOptions: Audience[] =
    role === "admin" ? ["all", "staff", "troupe"]
    : role === "troupe" ? ["all", "troupe"]
    : role === "staff" ? ["all", "staff"]
    : ["all"];

  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [audience, setAudience] = useState<Audience>("all");
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (accept: string) => {
    inputRef.current!.accept = accept;
    inputRef.current!.click();
  };

  const setMediaFile = (f: File) => {
    if (f.size > 50 * 1024 * 1024) { toast.error("Max 50MB"); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setMediaFile(f);
  };

  const clearMedia = () => { setFile(null); setPreview(null); };

  const submit = async () => {
    if (!user) return;
    if (!content.trim() && !file) { toast.error("Add something to post"); return; }

    const isVideo = file?.type.startsWith("video");
    if (isVideo && !/#ndere\b/i.test(content)) {
      toast.error("Video posts must include #ndere");
      return;
    }

    setBusy(true);
    try {
      let media_url: string | null = null;
      let media_kind: "text" | "photo" | "video" = "text";
      if (file) {
        media_kind = isVideo ? "video" : "photo";
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("media").upload(path, file);
        if (upErr) throw upErr;
        media_url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      }
      const { data: inserted, error } = await supabase.from("posts").insert({
        user_id: user.id, content: content.trim() || null, media_url, media_kind, audience,
      }).select("id").maybeSingle();
      if (error) throw error;
      if (inserted?.id && audience === "all") {
        notifyAllUsers(user.id, "post", inserted.id).catch(() => {});
      }
      toast.success(isVideo ? "Posted — auto-deletes in 3 days" : "Posted");
      navigate("/");
    } catch (e: any) {
      toast.error(e.message || "Failed to post");
    } finally { setBusy(false); }
  };

  if (loading || !user) return (
    <div className="min-h-screen grid place-items-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <Layout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display font-bold text-lg">New post</h1>
          <Button onClick={submit} disabled={busy} size="sm" className="bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold rounded-full px-4 shadow-[var(--shadow-warm)]">
            <Send className="w-3.5 h-3.5 mr-1.5" /> Post
          </Button>
        </div>

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's happening? Use @ to mention. Videos need #ndere"
          maxLength={500}
          autoFocus
          className="glass-input resize-none min-h-[140px] text-base border-0 focus-visible:ring-1 focus-visible:ring-primary/40"
        />

        {preview && (
          <div className="relative rounded-2xl overflow-hidden border border-white/10">
            {file?.type.startsWith("video") ? (
              <div className="w-full h-96 bg-black">
                <NativeVideo src={preview} autoPlayOnVisible={0} loop defaultMuted fit="cover" />
              </div>
            ) : (
              <img src={preview} alt="" className="w-full max-h-96 object-cover" />
            )}
            <button onClick={clearMedia} className="absolute top-2 right-2 p-1.5 rounded-full bg-background/70 backdrop-blur-md hover:bg-background">
              <X className="w-4 h-4" />
            </button>
            {file?.type.startsWith("video") && (
              <div className="absolute bottom-2 left-2 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-background/70 backdrop-blur-md text-accent">
                3 day lifespan
              </div>
            )}
          </div>
        )}

        <input ref={inputRef} type="file" hidden onChange={onFile} />

        <div className="glass-strong rounded-2xl p-3 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <button
              onClick={async () => {
                // Native: action sheet (Camera / Gallery). Web: file input.
                const f = await pickMedia({ source: "ask", video: false });
                if (f) setMediaFile(f);
              }}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl hover:bg-white/5 text-primary"
              aria-label="Photo">
              <ImageIcon className="w-5 h-5" />
              <span className="text-[10px] uppercase tracking-wider">Photo</span>
            </button>
            <button onClick={() => pick("video/*")} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl hover:bg-white/5 text-primary" aria-label="Video from files">
              <Film className="w-5 h-5" />
              <span className="text-[10px] uppercase tracking-wider">Video</span>
            </button>
            <button
              onClick={async () => {
                if (Capacitor.isNativePlatform()) {
                  const f = await pickMedia({ source: "camera", video: false });
                  if (f) setMediaFile(f);
                } else {
                  setCameraOpen(true);
                }
              }}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl hover:bg-white/5 text-primary"
              aria-label="Camera">
              <Camera className="w-5 h-5" />
              <span className="text-[10px] uppercase tracking-wider">Camera</span>
            </button>
          </div>
          <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)}
            disabled={audienceOptions.length === 1}
            className="glass-input rounded-xl px-3 py-2 text-sm capitalize cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-60 disabled:cursor-not-allowed">
            {audienceOptions.includes("all") && <option value="all">Everyone</option>}
            {audienceOptions.includes("staff") && <option value="staff">Staff only</option>}
            {audienceOptions.includes("troupe") && <option value="troupe">Troupe only</option>}
          </select>
        </div>
      </div>

      {cameraOpen && <CameraCapture onCapture={setMediaFile} onClose={() => setCameraOpen(false)} />}
    </Layout>
  );
}
