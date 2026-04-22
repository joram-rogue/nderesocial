import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  initial: { display_name: string; bio: string | null; avatar_url: string | null };
  onSaved: () => void;
  onClose: () => void;
};

export const ProfileEditor = ({ initial, onSaved, onClose }: Props) => {
  const { user } = useAuth();
  const [name, setName] = useState(initial.display_name);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [avatar, setAvatar] = useState<string | null>(initial.avatar_url);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    const path = `${user.id}/avatar-${Date.now()}.${f.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("media").upload(path, f);
    if (error) { toast.error(error.message); return; }
    setAvatar(supabase.storage.from("media").getPublicUrl(path).data.publicUrl);
  };

  const save = async () => {
    if (!user) return;
    if (!name.trim()) { toast.error("Name required"); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      display_name: name.trim(), bio: bio.trim() || null, avatar_url: avatar,
    }).eq("id", user.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4 animate-fade-in">
      <div className="glass-strong rounded-3xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">Edit profile</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center gap-4 mb-5">
          <button onClick={() => fileRef.current?.click()} className="relative w-20 h-20 rounded-full overflow-hidden group">
            {avatar ? (
              <img src={avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-display text-2xl font-bold">
                {name[0]?.toUpperCase() ?? "U"}
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 grid place-items-center transition-opacity">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </button>
          <input ref={fileRef} type="file" hidden accept="image/*" onChange={pickAvatar} />
          <p className="text-xs text-muted-foreground">Tap avatar to change</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input className="glass-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <Label>Bio</Label>
            <Textarea className="glass-input resize-none min-h-[80px]" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} placeholder="About you…" />
          </div>
        </div>

        <Button onClick={save} disabled={busy} className="w-full mt-5 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl py-6 font-semibold">
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
};
