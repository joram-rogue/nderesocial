import { useEffect, useRef } from "react";

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

  useEffect(() => {
    loadScript();
    // @ts-ignore — retrigger embed render
    if ((window as any).tiktokEmbed?.lib?.render) (window as any).tiktokEmbed.lib.render([ref.current]);
  }, [videoId]);

  return (
    <blockquote
      ref={ref}
      className="tiktok-embed"
      cite={`https://www.tiktok.com/@${handle || "user"}/video/${videoId}`}
      data-video-id={videoId}
      style={{ maxWidth: "605px", minWidth: "325px", margin: 0 }}
    >
      <section />
    </blockquote>
  );
};
