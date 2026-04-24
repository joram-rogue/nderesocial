import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import logo from "@/assets/ndere-logo.png";
import { useAuth } from "@/hooks/useAuth";

export default function Auth() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [role, setRole] = useState<"staff" | "troupe">("troupe");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (user) navigate("/", { replace: true }); }, [user, navigate]);

  const pickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/");
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const nextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || password.length < 6 || !name.trim()) { toast.error("Fill all fields"); return; }
    setStep(2);
  };

  const signUp = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/`, data: { display_name: name.trim() } },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Signup failed");

      let avatar_url: string | null = null;
      if (avatarFile) {
        const path = `${data.user.id}/avatar-${Date.now()}.${avatarFile.name.split(".").pop()}`;
        const { error: upErr } = await supabase.storage.from("media").upload(path, avatarFile);
        if (!upErr) avatar_url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      }

      // Wait briefly for trigger to create profile, then update
      await new Promise((r) => setTimeout(r, 400));
      await supabase.from("profiles").update({
        display_name: name.trim(),
        bio: bio.trim() || null,
        avatar_url,
      }).eq("id", data.user.id);

      await supabase.from("user_roles").insert({ user_id: data.user.id, role });

      toast.success("Welcome to Ndere FAM");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md glass-strong rounded-3xl p-8 animate-fade-in">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="Ndere FAM" className="w-14 h-14 mb-3 drop-shadow-[0_0_24px_hsl(22_47%_53%/0.5)]" />
          <h1 className="font-display text-2xl font-bold">Ndere <span className="text-gradient-warm">FAM</span></h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin" ? "Welcome back" : step === 1 ? "Join the family" : "Set up your profile"}
          </p>
        </div>

        {mode === "signin" ? (
          <form onSubmit={signIn} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input className="glass-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input className="glass-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold rounded-xl py-6 hover:opacity-90 shadow-[var(--shadow-warm)]">
              {busy ? "..." : "Sign in"}
            </Button>
          </form>
        ) : step === 1 ? (
          <form onSubmit={nextStep} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input className="glass-input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input className="glass-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input className="glass-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label>I am</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["staff", "troupe"] as const).map((r) => (
                  <button type="button" key={r} onClick={() => setRole(r)}
                    className={`glass rounded-xl py-3 text-sm font-medium capitalize transition-all ${role === r ? "ring-2 ring-primary !bg-primary/20" : "hover:bg-primary/10"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold rounded-xl py-6 hover:opacity-90 shadow-[var(--shadow-warm)]">
              Next
            </Button>
          </form>
        ) : (
          <div className="space-y-5 animate-fade-in">
            <div className="flex flex-col items-center gap-3">
              <button type="button" onClick={() => fileRef.current?.click()} className="relative w-24 h-24 rounded-full overflow-hidden group">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-display text-3xl font-bold">
                    {name[0]?.toUpperCase() ?? "U"}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 grid place-items-center transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </button>
              <input ref={fileRef} type="file" hidden accept="image/*" onChange={pickAvatar} />
              <p className="text-xs text-muted-foreground">Tap to add a profile photo</p>
            </div>

            <div className="space-y-2">
              <Label>Bio <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea className="glass-input resize-none min-h-[90px]" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} placeholder="Tell the FAM about yourself…" />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)} className="flex-1 rounded-xl py-6">Back</Button>
              <Button type="button" onClick={signUp} disabled={busy} className="flex-[2] bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold rounded-xl py-6 hover:opacity-90 shadow-[var(--shadow-warm)]">
                {busy ? "Creating…" : "Create account"}
              </Button>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === "signin" ? "New here?" : "Have an account?"}{" "}
          <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setStep(1); }} className="text-primary hover:underline font-medium">
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
