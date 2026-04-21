import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/ndere-logo.png";
import { useAuth } from "@/hooks/useAuth";

export default function Auth() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"staff" | "troupe">("troupe");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) navigate("/", { replace: true }); }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/`, data: { display_name: name || email.split("@")[0] } },
        });
        if (error) throw error;
        if (data.user) {
          await supabase.from("user_roles").insert({ user_id: data.user.id, role });
        }
        toast.success("Welcome to Ndere FAM");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
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
          <p className="text-sm text-muted-foreground mt-1">{mode === "signin" ? "Welcome back" : "Join the family"}</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label>Name</Label>
              <Input className="glass-input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Email</Label>
            <Input className="glass-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input className="glass-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>

          {mode === "signup" && (
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
          )}

          <Button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold rounded-xl py-6 hover:opacity-90 shadow-[var(--shadow-warm)]">
            {busy ? "..." : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === "signin" ? "New here?" : "Have an account?"}{" "}
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-primary hover:underline font-medium">
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
