import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

const navItems = [
  { name: "How It Works", href: "/#how-it-works" },
  { name: "Browse", href: "/vendor-search" },
  { name: "For Vendors", href: "/#vendors" },
  { name: "Reviews", href: "/#testimonials" },
];

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
              className="h-12 md:h-14 w-auto block object-contain"
            />
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-sm font-medium text-foreground/70 hover:text-primary hover:bg-[hsl(var(--primary-pale))] px-3.5 py-2 rounded-lg transition-colors"
              >
                {item.name}
              </a>
            ))}
          </div>

          {/* Desktop auth actions */}
          <div className="hidden md:flex items-center gap-2.5">
            <Link
              to="/login"
              className="text-sm font-medium text-foreground/70 hover:text-primary hover:bg-[hsl(var(--primary-pale))] px-3.5 py-2 rounded-lg transition-colors"
            >
              Sign In
            </Link>
            <Link to="/register">
              <Button
                size="sm"
                className="h-auto bg-primary hover:bg-[hsl(var(--primary-glow))] text-white font-semibold px-5 py-2.5 rounded-lg shadow-none"
              >
                Get Started →
              </Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg text-foreground hover:bg-muted transition-colors"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>
      </header>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden fixed top-[80px] left-0 right-0 z-40 bg-white border-b border-border shadow-[var(--shadow-md)] px-[5vw] py-4 flex flex-col gap-1">
          {navItems.map((item) => (
            <a
              key={item.name}
              href={item.href}
              onClick={() => setIsMenuOpen(false)}
              className="text-[15px] font-medium text-foreground/70 hover:text-primary hover:bg-[hsl(var(--primary-pale))] px-2 py-3 rounded-lg transition-colors"
            >
              {item.name}
            </a>
          ))}
          <Link
            to="/login"
            onClick={() => setIsMenuOpen(false)}
            className="text-[15px] font-medium text-foreground/70 hover:text-primary hover:bg-[hsl(var(--primary-pale))] px-2 py-3 rounded-lg transition-colors"
          >
            Sign In
          </Link>
          <Link to="/register" onClick={() => setIsMenuOpen(false)} className="mt-2">
            <Button className="w-full h-auto bg-primary hover:bg-[hsl(var(--primary-glow))] text-white font-semibold py-3 rounded-lg">
              Get Started →
            </Button>
          </Link>
        </div>
      )}
    </>
  );
};
