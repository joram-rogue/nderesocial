// Parse any pasted video link → produce an embeddable URL + platform label.
// Supports TikTok, YouTube, Instagram, Vimeo, Twitter/X, Facebook, direct video files,
// and falls back to a generic iframe embed for everything else.

export type ParsedLink = {
  platform: "tiktok" | "youtube" | "instagram" | "vimeo" | "twitter" | "facebook" | "video" | "generic";
  embed_url: string;
  video_id: string; // unique key for de-duping; for generic links we use the URL itself
  author_handle: string | null;
};

const safeUrl = (raw: string): URL | null => {
  try { return new URL(raw.trim()); } catch { return null; }
};

export const parseAnyVideoLink = (raw: string): ParsedLink | null => {
  const u = safeUrl(raw);
  if (!u) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");

  // YouTube
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    let id = "";
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
    else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2] || "";
    else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] || "";
    if (id) return {
      platform: "youtube",
      embed_url: `https://www.youtube.com/embed/${id}?playsinline=1&rel=0`,
      video_id: id,
      author_handle: null,
    };
  }

  // TikTok
  if (host.endsWith("tiktok.com")) {
    const m = u.pathname.match(/@([^/]+)\/video\/(\d+)/);
    if (m) return {
      platform: "tiktok",
      embed_url: `https://www.tiktok.com/embed/v2/${m[2]}`,
      video_id: m[2],
      author_handle: m[1],
    };
    const v = u.pathname.match(/\/v\/(\d+)/);
    if (v) return { platform: "tiktok", embed_url: `https://www.tiktok.com/embed/v2/${v[1]}`, video_id: v[1], author_handle: null };
    // Short links (vm.tiktok.com / vt.tiktok.com / t/...) — fall through to generic iframe of the URL
    return { platform: "tiktok", embed_url: u.toString(), video_id: u.toString(), author_handle: null };
  }

  // Instagram (reel/p/tv)
  if (host.endsWith("instagram.com")) {
    const m = u.pathname.match(/\/(reel|p|tv)\/([^/]+)/);
    if (m) return {
      platform: "instagram",
      embed_url: `https://www.instagram.com/${m[1]}/${m[2]}/embed`,
      video_id: m[2],
      author_handle: null,
    };
  }

  // Vimeo
  if (host.endsWith("vimeo.com")) {
    const id = u.pathname.split("/").filter(Boolean).pop();
    if (id && /^\d+$/.test(id)) return {
      platform: "vimeo",
      embed_url: `https://player.vimeo.com/video/${id}`,
      video_id: id,
      author_handle: null,
    };
  }

  // Twitter/X — uses tweet embed via twitframe
  if (host === "twitter.com" || host === "x.com") {
    return {
      platform: "twitter",
      embed_url: `https://twitframe.com/show?url=${encodeURIComponent(u.toString())}`,
      video_id: u.pathname,
      author_handle: u.pathname.split("/")[1] || null,
    };
  }

  // Facebook
  if (host.endsWith("facebook.com") || host === "fb.watch") {
    return {
      platform: "facebook",
      embed_url: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u.toString())}&show_text=false`,
      video_id: u.toString(),
      author_handle: null,
    };
  }

  // Direct video files
  if (/\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(u.pathname)) {
    return { platform: "video", embed_url: u.toString(), video_id: u.toString(), author_handle: null };
  }

  // Generic — best-effort iframe; some sites will refuse via X-Frame-Options
  return { platform: "generic", embed_url: u.toString(), video_id: u.toString(), author_handle: host };
};
