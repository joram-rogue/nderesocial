import logo from "@/assets/ndere-logo.png";

export const LogoLoader = ({ size = 56 }: { size?: number }) => (
  <div
    className="relative inline-block"
    style={{ width: size, height: size }}
    aria-label="Loading"
    role="status"
  >
    {/* Greyscale base */}
    <img
      src={logo}
      alt=""
      className="absolute inset-0 w-full h-full opacity-25"
      style={{ filter: "grayscale(100%) brightness(1.4)" }}
    />
    {/* Color fill — masked to logo shape, sweeps bottom→top */}
    <div
      className="absolute inset-0 w-full h-full animate-logo-fill"
      style={{
        WebkitMaskImage: `url(${logo})`,
        maskImage: `url(${logo})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        background: "var(--gradient-warm)",
      }}
    />
  </div>
);
