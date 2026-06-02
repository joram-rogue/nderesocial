import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Image as ImageIcon, Film, X, Send, Camera } from "lucide-react";
import { toast } from "sonner";
import { CameraCapture } from "./CameraCapture";
import { NativeVideo } from "./NativeVideo";
import { notifyAllUsers } from "@/hooks/useNotifications";

type Audience = "all" | "staff" | "troupe";

export const PostComposer = ({ onPosted }: { onPosted: () => void }) => {
  const { user, role } = useAuth();
  // Audience options based on role:
  // - troupe members: can post to Everyone or Troupe-only
  // - staff: can post to Everyone or Staff-only
  // - admin: can post anywhere
  // - everyone else: Everyone only
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
      setContent(""); clearMedia(); setAudience("all");
      toast.success(isVideo ? "Posted — auto-deletes in 30 min" : "Posted");
      onPosted();
    } catch (e: any) {
      toast.error(e.message || "Failed to post");
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="glass-strong rounded-3xl p-5 space-y-3 animate-fade-in">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's happening? Videos need #ndere"
          maxLength={500}
          className="glass-input resize-none min-h-[80px] text-base border-0 focus-visible:ring-1 focus-visible:ring-primary/40"
        />
        {preview && (
          <div className="relative rounded-2xl overflow-hidden border border-white/10">
            {file?.type.startsWith("video") ? (
              <div className="w-full h-80 bg-black">
                <NativeVideo src={preview} autoPlayOnVisible={0} loop defaultMuted fit="cover" />
              </div>
            ) : (
              <img src={preview} alt="" className="w-full max-h-80 object-cover" />
            )}
            <button onClick={clearMedia} className="absolute top-2 right-2 p-1.5 rounded-full bg-background/70 backdrop-blur-md hover:bg-background">
              <X className="w-4 h-4" />
            </button>
            {file?.type.startsWith("video") && (
              <div className="absolute bottom-2 left-2 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-background/70 backdrop-blur-md text-accent">
                30 min lifespan
              </div>
            )}
          </div>
        )}
        <input ref={inputRef} type="file" hidden onChange={onFile} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1">
            <button onClick={() => pick("image/*")} className="p-2 rounded-xl hover:bg-white/5 text-primary" aria-label="Photo"><ImageIcon className="w-5 h-5" /></button>
            <button onClick={() => pick("video/*")} className="p-2 rounded-xl hover:bg-white/5 text-primary" aria-label="Video"><Film className="w-5 h-5" /></button>
            <button onClick={() => setCameraOpen(true)} className="p-2 rounded-xl hover:bg-white/5 text-primary" aria-label="Camera"><Camera className="w-5 h-5" /></button>
          </div>
          <div className="flex items-center gap-2">
            <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)}
              disabled={audienceOptions.length === 1}
              className="glass-input rounded-xl px-3 py-2 text-sm capitalize cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-60 disabled:cursor-not-allowed">
              {audienceOptions.includes("all") && <option value="all">Everyone</option>}
              {audienceOptions.includes("staff") && <option value="staff">Staff only</option>}
              {audienceOptions.includes("troupe") && <option value="troupe">Troupe only</option>}
            </select>
            <Button onClick={submit} disabled={busy} className="bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold rounded-xl px-5 shadow-[var(--shadow-warm)]">
              <Send className="w-4 h-4 mr-1.5" /> Post
            </Button>
          </div>
        </div>
      </div>
      {cameraOpen && <CameraCapture onCapture={setMediaFile} onClose={() => setCameraOpen(false)} />}
    </>
  );
};
