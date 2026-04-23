import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

export const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 60);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const navItems = [
        { name: "Home", path: "/" },
        { name: "Services", path: "/" },
        { name: "About", path: "/" },
        { name: "Contact", path: "/" },
    ];

    const isScrolled = scrolled;

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                isScrolled
                    ? "bg-white border-b border-border shadow-sm"
                    : "bg-white/10 backdrop-blur-md border-b border-white/20"
            }`}
        >
            <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    {/* Logo */}
                    <Link to="/" className="flex items-center">
                        <img
                            src="/Plagohive.svg"
                            alt="Plagohive"
                            className="h-44 sm:h-50 drop-shadow-lg"
                        />
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.name}
                                to={item.path}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                                    isScrolled
                                        ? "text-foreground/70 hover:text-foreground hover:bg-muted"
                                        : "text-white/85 hover:text-white hover:bg-white/10"
                                }`}
                            >
                                {item.name}
                            </Link>
                        ))}
                    </div>

                    {/* Desktop CTA Buttons */}
                    <div className="hidden md:flex items-center space-x-3">
                        <Link to="/login">
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`font-medium transition-colors duration-200 ${
                                    isScrolled
                                        ? "text-foreground hover:bg-muted"
                                        : "text-white hover:bg-white/15 hover:text-white"
                                }`}
                            >
                                Login
                            </Button>
                        </Link>
                        <Link to="/register">
                            <Button
                                size="sm"
                                className={`font-semibold shadow-sm transition-colors duration-200 ${
                                    isScrolled
                                        ? "bg-primary text-white hover:bg-primary/90"
                                        : "bg-white text-primary hover:bg-white/90"
                                }`}
                            >
                                Sign Up
                            </Button>
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`md:hidden p-2 rounded-lg transition-colors ${
                            isScrolled
                                ? "text-foreground hover:bg-muted"
                                : "text-white hover:bg-white/15"
                        }`}
                        aria-label="Toggle menu"
                    >
                        {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>

                {/* Mobile Navigation */}
                {isMenuOpen && (
                    <div
                        className={`md:hidden py-3 pb-4 border-t space-y-1 ${
                            isScrolled ? "border-border bg-white" : "border-white/20"
                        }`}
                    >
                        {navItems.map((item) => (
                            <Link
                                key={item.name}
                                to={item.path}
                                onClick={() => setIsMenuOpen(false)}
                                className={`block text-sm font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 ${
                                    isScrolled
                                        ? "text-foreground/70 hover:text-foreground hover:bg-muted"
                                        : "text-white/85 hover:text-white hover:bg-white/10"
                                }`}
                            >
                                {item.name}
                            </Link>
                        ))}
                        <div className={`pt-3 space-y-2 border-t mt-2 ${isScrolled ? "border-border" : "border-white/20"}`}>
                            <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                                <Button
                                    variant="ghost"
                                    className={`w-full ${isScrolled ? "text-foreground hover:bg-muted" : "text-white hover:bg-white/15"}`}
                                >
                                    Login
                                </Button>
                            </Link>
                            <Link to="/register" onClick={() => setIsMenuOpen(false)}>
                                <Button className={`w-full font-semibold ${isScrolled ? "bg-primary text-white" : "bg-white text-primary hover:bg-white/90"}`}>
                                    Sign Up
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}
            </nav>
        </header>
    );
};
