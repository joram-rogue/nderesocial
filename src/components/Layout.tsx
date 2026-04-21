import { Link, NavLink, useNavigate } from "react-router-dom";
import { Home, User, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/ndere-logo.png";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24 md:pb-10">
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
        <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 glass-strong rounded-full px-2 py-2 flex gap-1 z-40 shadow-[var(--shadow-glass)]">
          <NavLink to="/" end className={({ isActive }) => `p-3 rounded-full transition-all ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Home className="w-5 h-5" />
          </NavLink>
          <NavLink to="/account" className={({ isActive }) => `p-3 rounded-full transition-all ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <User className="w-5 h-5" />
          </NavLink>
        </nav>
      )}
    </div>
  );
};
