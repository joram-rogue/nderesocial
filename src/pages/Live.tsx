import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Radio, Users, Square, Copy, Eye } from "lucide-react";
import { toast } from "sonner";

// Lightweight WebRTC live stream:
// - Broadcaster captures camera+mic, signals over a Supabase Realtime channel.
// - Each viewer creates a separate peer connection back to the broadcaster.
// Suitable for small audiences. For scale, swap in a media server later.

const ICE: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

type Role = "host" | "viewer" | null;

export default function Live() {
  const { user } = useAuth();
  const { id: routeId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [role, setRole] = useState<Role>(null);
  const [streamId, setStreamId] = useState<string | null>(routeId ?? params.get("id"));
  const [viewers, setViewers] = useState(0);
  const [live, setLive] = useState(false);

  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ---- Cleanup ----
  const cleanup = () => {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLive(false);
    setViewers(0);
  };
  useEffect(() => () => cleanup(), []);

  // ---- HOST: start broadcast ----
  const startBroadcast = async () => {
    if (!user) { toast.error("Sign in"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      localStreamRef.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;
      const id = crypto.randomUUID();
      setStreamId(id);
      setRole("host");
      setLive(true);

      const channel = supabase.channel(`live-${id}`, { config: { broadcast: { self: false } } });
      channelRef.current = channel;

      channel.on("broadcast", { event: "join" }, async ({ payload }) => {
        const viewerId = payload.viewerId as string;
        const pc = new RTCPeerConnection(ICE);
        peersRef.current.set(viewerId, pc);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        pc.onicecandidate = (ev) => {
          if (ev.candidate) channel.send({ type: "broadcast", event: "ice", payload: { to: viewerId, from: "host", candidate: ev.candidate } });
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({ type: "broadcast", event: "offer", payload: { to: viewerId, sdp: offer } });
        setViewers(peersRef.current.size);
      });

      channel.on("broadcast", { event: "answer" }, async ({ payload }) => {
        const pc = peersRef.current.get(payload.from);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      });

      channel.on("broadcast", { event: "ice" }, async ({ payload }) => {
        if (payload.to !== "host") return;
        const pc = peersRef.current.get(payload.from);
        if (pc && payload.candidate) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      });

      channel.on("broadcast", { event: "leave" }, ({ payload }) => {
        const pc = peersRef.current.get(payload.viewerId);
        pc?.close();
        peersRef.current.delete(payload.viewerId);
        setViewers(peersRef.current.size);
      });

      await channel.subscribe();
      toast.success("You're live!");
    } catch (e: any) {
      toast.error(e.message || "Couldn't access camera");
    }
  };

  const stopBroadcast = () => {
    channelRef.current?.send({ type: "broadcast", event: "ended", payload: {} });
    cleanup();
    toast.success("Live ended");
  };

  // ---- VIEWER: join broadcast ----
  const joinAsViewer = async (id: string) => {
    setRole("viewer");
    setStreamId(id);
    const viewerId = crypto.randomUUID();
    const pc = new RTCPeerConnection(ICE);
    peersRef.current.set("host", pc);

    pc.ontrack = (ev) => {
      if (remoteRef.current) {
        remoteRef.current.srcObject = ev.streams[0];
        setLive(true);
      }
    };

    const channel = supabase.channel(`live-${id}`, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) channel.send({ type: "broadcast", event: "ice", payload: { to: "host", from: viewerId, candidate: ev.candidate } });
    };

    channel.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (payload.to !== viewerId) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      channel.send({ type: "broadcast", event: "answer", payload: { from: viewerId, sdp: answer } });
    });

    channel.on("broadcast", { event: "ice" }, async ({ payload }) => {
      if (payload.to !== viewerId) return;
      if (payload.candidate) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
    });

    channel.on("broadcast", { event: "ended" }, () => {
      toast("Stream ended");
      cleanup();
      navigate("/");
    });

    await channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        channel.send({ type: "broadcast", event: "join", payload: { viewerId } });
      }
    });
  };

  useEffect(() => {
    if (routeId && !role) joinAsViewer(routeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  const copyShare = async () => {
    if (!streamId) return;
    const url = `${window.location.origin}/live/${streamId}`;
    await navigator.clipboard.writeText(url);
    toast.success("Live link copied — share it!");
  };

  // ---- UI ----
  if (role === "viewer") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        <video ref={remoteRef} autoPlay playsInline className="flex-1 w-full object-contain" />
        {!live && <div className="absolute inset-0 grid place-items-center text-white/70 text-sm">Connecting to live…</div>}
        <button onClick={() => { cleanup(); navigate("/"); }} className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-white/10 text-white text-xs">Leave</button>
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 animate-fade-in">
        <div className="glass-strong rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl grid place-items-center ${live ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-primary/15 text-primary"}`}>
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg">Go Live</h1>
              <p className="text-xs text-muted-foreground">Broadcast to your followers in real time.</p>
            </div>
          </div>

          <div className="relative aspect-[9/16] sm:aspect-video rounded-2xl overflow-hidden bg-black border border-white/5">
            <video ref={localRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            {live && (
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-wider">Live</span>
                <span className="px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-semibold flex items-center gap-1"><Eye className="w-3 h-3" />{viewers}</span>
              </div>
            )}
          </div>

          {!live ? (
            <Button onClick={startBroadcast} className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-2xl py-6 font-semibold gap-2">
              <Radio className="w-4 h-4" /> Start broadcasting
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={copyShare} variant="ghost" className="glass rounded-2xl py-5 gap-2">
                <Copy className="w-4 h-4" /> Copy link
              </Button>
              <Button onClick={stopBroadcast} className="bg-destructive text-destructive-foreground rounded-2xl py-5 gap-2">
                <Square className="w-4 h-4" /> End live
              </Button>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
            <Users className="w-3 h-3" /> Best for small live audiences. Share the link with your group.
          </p>
        </div>
      </div>
    </Layout>
  );
}
