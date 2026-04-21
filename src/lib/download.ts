// Apply Ndere FAM watermark and trigger download for images/videos/text
import logoUrl from "@/assets/ndere-logo.png";

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

export async function downloadImageWithWatermark(url: string, filename = "ndere-fam.png") {
  const [img, logo] = await Promise.all([loadImage(url), loadImage(logoUrl)]);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  // Bottom-right watermark
  const pad = Math.max(16, canvas.width * 0.02);
  const logoSize = Math.max(56, canvas.width * 0.07);
  const text = "Ndere FAM";
  ctx.font = `600 ${Math.max(18, canvas.width * 0.022)}px Sora, sans-serif`;
  const textW = ctx.measureText(text).width;
  const boxH = logoSize;
  const boxW = logoSize + 12 + textW + pad;
  const x = canvas.width - boxW - pad;
  const y = canvas.height - boxH - pad;

  ctx.fillStyle = "rgba(26,15,10,0.55)";
  ctx.beginPath();
  // @ts-ignore
  ctx.roundRect ? ctx.roundRect(x, y, boxW, boxH, 16) : ctx.rect(x, y, boxW, boxH);
  ctx.fill();
  ctx.drawImage(logo, x + 8, y + (boxH - logoSize + 16) / 2, logoSize - 16, logoSize - 16);
  ctx.fillStyle = "rgba(240,216,184,0.95)";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + logoSize, y + boxH / 2);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
}

export function downloadFile(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener";
  a.click();
}

export function downloadText(content: string, author: string, filename = "ndere-fam.txt") {
  const text = `${content}\n\n— ${author}\nNdere FAM`;
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
