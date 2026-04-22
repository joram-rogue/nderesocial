export const extractTikTokVideoId = (url: string): { id: string; handle: string | null } | null => {
  try {
    const u = new URL(url.trim());
    // https://www.tiktok.com/@handle/video/1234567890
    const m = u.pathname.match(/@([^/]+)\/video\/(\d+)/);
    if (m) return { handle: m[1], id: m[2] };
    // short link vm.tiktok.com/XXXX — cannot resolve here; use pathname tail
    const tail = u.pathname.replace(/\/+$/, "").split("/").pop();
    if (tail && /^\d+$/.test(tail)) return { id: tail, handle: null };
    return null;
  } catch { return null; }
};
