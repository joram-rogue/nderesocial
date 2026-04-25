import { LogoLoader } from "./LogoLoader";
import { TikTokEmbed } from "./TikTokEmbed";

type Props = {
  platform: string;
  embed_url: string | null;
  video_id: string;
  handle: string | null;
};

// Renders any pasted-link reel — picks the right player per platform.
export const ExternalReel = ({ platform, embed_url, video_id, handle }: Props) => {
  if (platform === "tiktok") {
    return <TikTokEmbed videoId={video_id} handle={handle} />;
  }
  if (platform === "video" && embed_url) {
    return (
      <video
        src={embed_url}
        className="w-full h-full object-contain bg-black"
        playsInline
        controls
        loop
      />
    );
  }
  if (!embed_url) {
    return <div className="grid place-items-center h-full"><LogoLoader size={48} /></div>;
  }
  return (
    <iframe
      src={embed_url}
      className="w-full h-full border-0 bg-black"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      loading="lazy"
      title={`${platform} reel`}
    />
  );
};
