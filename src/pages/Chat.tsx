import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Mic, Send, Square, Play, Pause, ArrowLeft, Users, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type Room = "all" | "staff" | "troupe";
type RoomMsg = {
  id: string; user_id: string; room: Room; content: string | null; voice_url: string | null; created_at: string;
  profile?: { display_name: string; avatar_url: string | null };
};
type DM = {
  id: string; sender_id: string; recipient_id: string; content: string | null; voice_url: string | null; created_at: string;
};
type Profile = { id: string; display_name: string; avatar_url: string | null };

const Avatar = ({ url, name, size = 36 }: { url?: string | null; name?: string | null; size?: number }) => (
  <div
    className="rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-bold"
    style={{ width: size, height: size, fontSize: size * 0.42 }}
  >
    {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <span>{name?.[0]?.toUpperCase() ?? "U"}</span>}
  </div>
);

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

type Mode = { kind: "room"; room: Room } | { kind: "dm"; peer: Profile } | { kind: "contacts" };

export default function Chat() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>({ kind: "room", room: "all" });
  const [messages, setMessages] = useState<(RoomMsg | DM)[]>([]);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, Profile>>(new Map());
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  // Load all members as contacts (excluding self)
  const loadContacts = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("id,display_name,avatar_url").neq("id", user.id).order("display_name");
    setContacts((data ?? []) as Profile[]);
  };
  useEffect(() => { loadContacts(); /* eslint-disable-next-line */ }, [user?.id]);

  const load = async () => {
    if (!user) return;
    if (mode.kind === "room") {
      const { data } = await supabase.from("chat_messages").select("*").eq("room", mode.room).order("created_at", { ascending: true }).limit(200);
      if (!data) return;
      const ids = [...new Set(data.map((m) => m.user_id))];
      const { data: profs } = await supabase.from("profiles").select("id,display_name,avatar_url").in("id", ids);
      const m = new Map((profs ?? []).map((p) => [p.id, p as Profile]));
      setProfileMap(m);
      setMessages(data.map((x) => ({ ...x, profile: m.get(x.user_id) })) as RoomMsg[]);
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 50);
    } else if (mode.kind === "dm") {
      const peerId = mode.peer.id;
      const { data } = await supabase.from("direct_messages").select("*")
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${user.id})`)
        .order("created_at", { ascending: true }).limit(300);
      setMessages((data ?? []) as DM[]);
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 50);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [mode]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    if (mode.kind === "room") {
      const ch = supabase.channel(`chat-${mode.room}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room=eq.${mode.room}` }, () => load())
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    } else if (mode.kind === "dm") {
      const peerId = mode.peer.id;
      const ch = supabase.channel(`dm-${peerId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload: any) => {
          const r = payload.new;
          if ((r.sender_id === user.id && r.recipient_id === peerId) || (r.sender_id === peerId && r.recipient_id === user.id)) load();
        })
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
    // eslint-disable-next-line
  }, [mode]);

  const send = async () => {
    if (!user || !text.trim()) return;
    if (mode.kind === "room") {
      const { error } = await supabase.from("chat_messages").insert({ room: mode.room, user_id: user.id, content: text.trim() });
      if (error) { toast.error(error.message); return; }
    } else if (mode.kind === "dm") {
      const { error } = await supabase.from("direct_messages").insert({ sender_id: user.id, recipient_id: mode.peer.id, content: text.trim() });
      if (error) { toast.error(error.message); return; }
    }
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
    if (mode.kind === "room") {
      const { error } = await supabase.from("chat_messages").insert({ room: mode.room, user_id: user.id, voice_url: url });
      if (error) toast.error(error.message);
    } else if (mode.kind === "dm") {
      const { error } = await supabase.from("direct_messages").insert({ sender_id: user.id, recipient_id: mode.peer.id, voice_url: url });
      if (error) toast.error(error.message);
    }
  };

  // ---------- Contacts list view ----------
  if (mode.kind === "contacts") {
    return (
      <Layout>
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setMode({ kind: "room", room: "all" })} className="p-2 rounded-full hover:bg-white/5">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="font-display font-bold text-lg">Direct messages</h2>
        </div>
        <div className="glass rounded-3xl p-2 space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto">
          {contacts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">No other members yet</p>
          ) : contacts.map((p) => (
            <button key={p.id} onClick={() => setMode({ kind: "dm", peer: p })}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors text-left">
              <Avatar url={p.avatar_url} name={p.display_name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{p.display_name}</p>
                <p className="text-xs text-muted-foreground">Tap to chat</p>
              </div>
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </Layout>
    );
  }

  // ---------- Chat view (room or DM) ----------
  return (
    <Layout>
      {/* Header: room tabs + DMs button, OR DM header with back button */}
      {mode.kind === "room" ? (
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex gap-1 p-1 glass-strong rounded-full">
            {(["all", "staff", "troupe"] as Room[]).map((r) => (
              <button key={r} onClick={() => setMode({ kind: "room", room: r })}
                className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-wider font-semibold transition-all
                  ${mode.room === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {r}
              </button>
            ))}
          </div>
          <button onClick={() => setMode({ kind: "contacts" })}
            className="p-2 rounded-full glass-strong hover:bg-white/10 transition-colors" aria-label="Contacts">
            <Users className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 mb-3 glass-strong rounded-full p-2 pr-4">
          <button onClick={() => setMode({ kind: "contacts" })} className="p-1.5 rounded-full hover:bg-white/5">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Avatar url={mode.peer.avatar_url} name={mode.peer.display_name} size={32} />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{mode.peer.display_name}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Direct message</p>
          </div>
        </div>
      )}

      <div ref={listRef} className="glass rounded-3xl p-4 h-[calc(100vh-280px)] overflow-y-auto space-y-3 mb-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">Say hi</p>
        ) : messages.map((m) => {
          const senderId = "user_id" in m ? m.user_id : m.sender_id;
          const mine = senderId === user?.id;
          const prof = mode.kind === "room" ? (m as RoomMsg).profile : (mode.kind === "dm" ? mode.peer : null);
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              {!mine && <Avatar url={prof?.avatar_url} name={prof?.display_name} size={32} />}
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${mine ? "bg-primary text-primary-foreground" : "glass-strong"}`}>
                {!mine && mode.kind === "room" && (
                  <p className="text-[10px] font-semibold text-accent mb-0.5">{(m as RoomMsg).profile?.display_name ?? "User"}</p>
                )}
                {m.content && <p className="text-sm break-words whitespace-pre-wrap">{m.content}</p>}
                {m.voice_url && <VoicePlayer url={m.voice_url} />}
              </div>
            </div>
          );
        })}
      </div>

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
    </Layout>
  );
}
