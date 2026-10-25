import { Button } from "@/components/ui/button";
import { Menu, X, LogOut } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { name: "How It Works", href: "/#how-it-works", anchor: "how-it-works" },
  { name: "Browse", href: "/vendor-search", anchor: null },
  { name: "For Vendors", href: "/#vendors", anchor: "vendors" },
  { name: "Reviews", href: "/#testimonials", anchor: "testimonials" },
];

export const Header = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
    setIsMenuOpen(false);
  };

  const dashboardPath =
    user?.role === "admin" ? "/admin" : user?.role === "support" ? "/support" : user?.role === "vendor" ? "/vendor-dashboard" : "/customer-dashboard";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = (item: typeof navItems[0], e: React.MouseEvent) => {
    setIsMenuOpen(false);
    if (!item.anchor) return;
    e.preventDefault();
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        document.getElementById(item.anchor!)?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      document.getElementById(item.anchor)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 h-[80px] bg-white/95 backdrop-blur-xl border-b border-border transition-shadow duration-300 ${
          scrolled ? "shadow-[var(--shadow-md)]" : ""
        }`}
      >
        <nav className="max-w-[1200px] mx-auto h-[80px] px-[5vw] flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center shrink-0">
            <img
              src="/Plagohive.svg"
              alt="Plagohive"
              className="w-auto block object-contain h-7 sm:h-8"
              loading="lazy"
            />
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                onClick={(e) => handleNavClick(item, e)}
                className="text-sm font-medium text-foreground/70 hover:text-primary hover:bg-primary/5 px-3.5 py-2 rounded-lg transition-colors"
              >
                {item.name}
              </a>
            ))}
          </div>

          {/* Desktop auth actions */}
          <div className="hidden md:flex items-center gap-2.5">
            {isAuthenticated ? (
              <>
                <Link
                  to={dashboardPath}
                  className="flex items-center gap-2 text-sm font-medium text-foreground/70 hover:text-primary hover:bg-primary/5 px-3.5 py-2 rounded-lg transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-xs">
                    {(user?.full_name?.[0] || user?.email?.[0] || "U").toUpperCase()}
                  </div>
                  {user?.full_name?.split(" ")[0] || "Dashboard"}
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleLogout}
                  className="h-auto px-3.5 py-2 text-sm font-medium text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4 mr-1.5" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-foreground/70 hover:text-primary hover:bg-primary/5 px-3.5 py-2 rounded-lg transition-colors"
                >
                  Sign In
                </Link>
                <Link to="/register">
                  <Button
                    size="sm"
                    className="h-auto bg-primary hover:bg-primary/90 text-white font-semibold px-5 py-2.5 rounded-lg shadow-none"
                  >
                    Get Started →
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-foreground hover:bg-muted transition-colors"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>
      </header>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden fixed top-[80px] left-0 right-0 z-40 bg-white border-b border-border shadow-lg px-[5vw] py-4 flex flex-col gap-1">
          {navItems.map((item) => (
            <a
              key={item.name}
              href={item.href}
              onClick={(e) => handleNavClick(item, e)}
              className="text-[15px] font-medium text-foreground/70 hover:text-primary hover:bg-primary/5 px-2 py-3 rounded-lg transition-colors"
            >
              {item.name}
            </a>
          ))}
          {isAuthenticated ? (
            <>
              <Link
                to={dashboardPath}
                onClick={() => setIsMenuOpen(false)}
                className="text-[15px] font-medium text-foreground/70 hover:text-primary hover:bg-primary/5 px-2 py-3 rounded-lg transition-colors"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="mt-2 text-[15px] font-medium text-destructive hover:bg-destructive/10 px-2 py-3 rounded-lg text-left transition-colors flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                onClick={() => setIsMenuOpen(false)}
                className="text-[15px] font-medium text-foreground/70 hover:text-primary hover:bg-primary/5 px-2 py-3 rounded-lg transition-colors"
              >
                Sign In
              </Link>
              <Link to="/register" onClick={() => setIsMenuOpen(false)} className="mt-2">
                <Button className="w-full h-auto bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-lg">
                  Get Started →
                </Button>
              </Link>
            </>
          )}
        </div>
      )}
    </>
  );
};
