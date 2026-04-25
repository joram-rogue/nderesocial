import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

export const InviteSheet = ({ onClose }: { onClose: () => void }) => {
  const url = `${window.location.origin}/auth`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join Ndere FAM", text: "Join me on Ndere FAM", url });
      } catch {/* user cancelled */}
    } else {
      copy();
      toast.success("Link copied — paste it anywhere");
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="w-full sm:max-w-sm glass-strong rounded-t-3xl sm:rounded-3xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">Invite to Ndere FAM</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>
        <div className="bg-white p-4 rounded-2xl grid place-items-center">
          <QRCodeSVG value={url} size={200} level="M" includeMargin={false} />
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Point a phone camera at this code to open the signup page.
        </p>
        <div className="flex gap-2">
          <button onClick={copy} className="flex-1 glass rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5">
            <Copy className="w-4 h-4" /> {copied ? "Copied!" : "Copy link"}
          </button>
          <button onClick={share} className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-gradient-to-r from-primary to-accent text-primary-foreground flex items-center justify-center gap-1.5">
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </div>
    </div>
  );
};
