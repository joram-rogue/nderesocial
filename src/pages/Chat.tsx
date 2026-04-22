import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Mic, Send, Square, Play, Pause, Lock } from "lucide-react";
import { toast } from "sonner";

type Room = "all" | "staff" | "troupe";
type Msg = {
  id: string; user_id: string; room: Room; content: string | null; voice_url: string | null; created_at: string;
  profile?: { display_name: string };
};

const VoicePlayer = ({ url }: { url: string }) => {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="flex items-center gap-2.5">
      <button onClick={() => { const a = ref.current!; if (playing) a.pause(); else a.play(); }}
        className="p-2 rounded-full bg-primary/30 hover:bg-primary/40 text-primary">
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <div className="h-1 w-32 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-primary/60 rounded-full animate-pulse" />
      </div>
      <audio ref={ref} src={url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    </div>
  );
};

export default function Chat() {
  const { user, role } = useAuth();
  const [room, setRoom] = useState<Room>("all");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  const rooms: Room[] = ["all", ...(role === "staff" ? ["staff"] : []), ...(role === "troupe" ? ["troupe"] : [])] as Room[];
  const canWrite = room === "all" || role === room || role === "admin";

  const load = async () => {
    const { data } = await supabase.from("chat_messages").select("*").eq("room", room).order("created_at", { ascending: true }).limit(200);
    if (!data) return;
    const ids = [...new Set(data.map((m) => m.user_id))];
    const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", ids);
    const m = new Map(profs?.map((p) => [p.id, p]));
    setMessages(data.map((x) => ({ ...x, profile: m.get(x.user_id) as any })) as Msg[]);
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 50);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [room]);

  useEffect(() => {
    const ch = supabase.channel(`chat-${room}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room=eq.${room}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [room]);

  const send = async () => {
    if (!user || !text.trim()) return;
    const { error } = await supabase.from("chat_messages").insert({ room, user_id: user.id, content: text.trim() });
    if (error) { toast.error(error.message); return; }
    setText("");
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await uploadVoice(blob);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch (e: any) { toast.error(e.message || "Mic denied"); }
  };

  const stopRec = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const uploadVoice = async (blob: Blob) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}.webm`;
    const { error: upErr } = await supabase.storage.from("voice-notes").upload(path, blob, { contentType: "audio/webm" });
    if (upErr) { toast.error(upErr.message); return; }
    const url = supabase.storage.from("voice-notes").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("chat_messages").insert({ room, user_id: user.id, voice_url: url });
    if (error) toast.error(error.message);
  };

  return (
    <Layout>
      <div className="flex gap-1 mb-3 p-1 glass-strong rounded-full w-fit mx-auto">
        {(["all", "staff", "troupe"] as Room[]).map((r) => {
          const allowed = r === "all" || rooms.includes(r);
          return (
            <button key={r} disabled={!allowed} onClick={() => setRoom(r)}
              className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-wider font-semibold transition-all flex items-center gap-1
                ${room === r ? "bg-primary text-primary-foreground" : allowed ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/40"}`}>
              {!allowed && <Lock className="w-3 h-3" />} {r}
            </button>
          );
        })}
      </div>

      <div ref={listRef} className="glass rounded-3xl p-4 h-[calc(100vh-280px)] overflow-y-auto space-y-3 mb-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">Say hi</p>
        ) : messages.map((m) => {
          const mine = m.user_id === user?.id;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              {!mine && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-xs font-bold text-primary-foreground shrink-0">
                  {m.profile?.display_name?.[0]?.toUpperCase() ?? "U"}
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${mine ? "bg-primary text-primary-foreground" : "glass-strong"}`}>
                {!mine && <p className="text-[10px] font-semibold text-accent mb-0.5">{m.profile?.display_name ?? "User"}</p>}
                {m.content && <p className="text-sm break-words whitespace-pre-wrap">{m.content}</p>}
                {m.voice_url && <VoicePlayer url={m.voice_url} />}
              </div>
            </div>
          );
        })}
      </div>

      {canWrite ? (
        <div className="flex gap-2 items-center">
          {recording ? (
            <div className="flex-1 flex items-center gap-3 glass-input rounded-full px-4 py-3">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-mono">{Math.floor(recSeconds/60)}:{String(recSeconds%60).padStart(2,"0")}</span>
              <span className="text-xs text-muted-foreground ml-auto">Recording…</span>
            </div>
          ) : (
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Message…" maxLength={500}
              className="flex-1 glass-input rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
          )}
          {text.trim() && !recording ? (
            <button onClick={send} className="p-3 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-[var(--shadow-warm)]">
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={recording ? stopRec : startRec}
              className={`p-3 rounded-full ${recording ? "bg-red-500 text-white" : "bg-primary/20 text-primary"}`}>
              {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
        </div>
      ) : (
        <div className="glass rounded-full text-center py-3 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <Lock className="w-3 h-3" /> Read-only in this room
        </div>
      )}
    </Layout>
  );
}
