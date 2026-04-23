// Parses any TikTok share format users get from the "Share → Copy link" button.
// Supports:
//   https://www.tiktok.com/@handle/video/1234567890
//   https://m.tiktok.com/v/1234567890.html
//   https://vm.tiktok.com/ZMabcdef/      (short)
//   https://vt.tiktok.com/ZSabcdef/      (short)
// For short links we resolve them via TikTok's oEmbed endpoint to get the canonical URL.

export type ParsedTikTok = { id: string; handle: string | null };

const parseCanonical = (raw: string): ParsedTikTok | null => {
  try {
    const u = new URL(raw.trim());
    const m = u.pathname.match(/@([^/]+)\/video\/(\d+)/);
    if (m) return { handle: m[1], id: m[2] };
    const v = u.pathname.match(/\/v\/(\d+)/);
    if (v) return { id: v[1], handle: null };
    const tail = u.pathname.replace(/\/+$/, "").split("/").pop();
    if (tail && /^\d{6,}$/.test(tail)) return { id: tail, handle: null };
    return null;
  } catch { return null; }
};

const isShortLink = (raw: string) => /(?:vm|vt)\.tiktok\.com/i.test(raw);

export const extractTikTokVideoId = (url: string): ParsedTikTok | null => {
  return parseCanonical(url);
};

// Async resolver — uses TikTok's public oEmbed to get the real video URL from a short link.
export const resolveTikTokUrl = async (raw: string): Promise<ParsedTikTok | null> => {
  const direct = parseCanonical(raw);
  if (direct) return direct;

  if (!isShortLink(raw)) return null;

  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(raw.trim())}`);
    if (!res.ok) return null;
    const data = await res.json();
    // oEmbed returns author_url like "https://www.tiktok.com/@handle" and html with the video id
    const handleMatch = typeof data.author_url === "string" ? data.author_url.match(/@([^/?#]+)/) : null;
    const idMatch = typeof data.html === "string" ? data.html.match(/data-video-id="(\d+)"/) : null;
    if (idMatch) return { id: idMatch[1], handle: handleMatch ? handleMatch[1] : (data.author_unique_id ?? null) };
    return null;
  } catch { return null; }
};
