import logo from "@/assets/ndere-logo.png";

export const Watermark = () => (
  <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/55 backdrop-blur-md border border-white/10 pointer-events-none select-none z-10">
    <img src={logo} alt="" className="w-3.5 h-3.5" />
    <span className="text-[10px] font-display font-semibold text-accent/90 tracking-wide">Ndere FAM</span>
  </div>
);
