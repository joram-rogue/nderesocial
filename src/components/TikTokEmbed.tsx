import { useEffect, useRef, useState } from "react";
import { LogoLoader } from "./LogoLoader";

declare global { interface Window { tiktokEmbedLoaded?: boolean } }

const loadScript = () => {
  if (window.tiktokEmbedLoaded) return;
  const s = document.createElement("script");
  s.src = "https://www.tiktok.com/embed.js";
  s.async = true;
  document.body.appendChild(s);
  window.tiktokEmbedLoaded = true;
};

export const TikTokEmbed = ({ videoId, handle }: { videoId: string; handle?: string | null }) => {
  const ref = useRef<HTMLQuoteElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    loadScript();
    // @ts-ignore — retrigger embed render
    if ((window as any).tiktokEmbed?.lib?.render) (window as any).tiktokEmbed.lib.render([ref.current]);

    // Watch for the iframe TikTok injects — reveal once present.
    if (!wrapRef.current) return;
    const obs = new MutationObserver(() => {
      const iframe = wrapRef.current?.querySelector("iframe");
      if (iframe) {
        // Give the iframe a beat to actually render content
        setTimeout(() => setReady(true), 350);
      }
    });
    obs.observe(wrapRef.current, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [videoId]);

  return (
    <div ref={wrapRef} className="relative w-full">
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          <LogoLoader size={56} />
        </div>
      )}
      <blockquote
        ref={ref}
        className="tiktok-embed"
        cite={`https://www.tiktok.com/@${handle || "user"}/video/${videoId}`}
        data-video-id={videoId}
        data-embed-from="oembed"
        style={{ maxWidth: "605px", minWidth: "325px", margin: 0 }}
      >
        <section />
      </blockquote>
    </div>
  );
};
