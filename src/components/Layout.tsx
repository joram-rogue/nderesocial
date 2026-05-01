import { Link, NavLink, useNavigate } from "react-router-dom";
import { Home, User, LogOut, Film, MessageCircle, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/ndere-logo.png";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-28 md:pb-10">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/60 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="" className="w-7 h-7" />
            <span className="font-display font-bold text-lg">Ndere <span className="text-gradient-warm">FAM</span></span>
          </Link>
          {user && (
            <div className="flex items-center gap-2">
              {role && <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full glass text-accent font-semibold">{role}</span>}
              <button onClick={async () => { await signOut(); navigate("/auth"); }}
                className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-5">{children}</main>

      {user && (
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-background/85 backdrop-blur-xl border-t border-border/60 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-2xl mx-auto grid grid-cols-5 h-16">
            <NavLink to="/" end className={({ isActive }) => `flex items-center justify-center transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Home className="w-6 h-6" />
            </NavLink>
            <NavLink to="/reels" className={({ isActive }) => `flex items-center justify-center transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Film className="w-6 h-6" />
            </NavLink>
            <NavLink to="/compose" aria-label="New post" className="flex items-center justify-center">
              <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground grid place-items-center shadow-[var(--shadow-warm)]">
                <Plus className="w-6 h-6" />
              </span>
            </NavLink>
            <NavLink to="/chat" className={({ isActive }) => `flex items-center justify-center transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <MessageCircle className="w-6 h-6" />
            </NavLink>
            <NavLink to="/account" className={({ isActive }) => `flex items-center justify-center transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <User className="w-6 h-6" />
            </NavLink>
          </div>
        </nav>
      )}
    </div>
  );
};
