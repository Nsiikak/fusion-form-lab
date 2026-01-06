import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

export const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const navItems = [
        { name: "Home", path: "/" },
        { name: "Services", path: "/services" },
        { name: "About", path: "/about" },
        { name: "Contact", path: "/contact" },
    ];

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20 shadow-lg">
            <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    {/* Logo */}
                    <Link to="/" className="flex items-center group">
                        <img
                            src="/Plagohive.svg"
                            alt="Plagohive"
                            className="h-44 sm:h-50 drop-shadow-lg transition-transform duration-300 group-hover:scale-105"
                        />
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-8">
                        {navItems.map((item) => (
                            <Link
                                key={item.name}
                                to={item.path}
                                className="text-white/90 hover:text-white font-medium transition-colors duration-200 hover:scale-105 transform"
                            >
                                {item.name}
                            </Link>
                        ))}
                    </div>

                    {/* Desktop CTA Buttons */}
                    <div className="hidden md:flex items-center space-x-4">
                        <Link to="/login">
                            <Button
                                variant="ghost"
                                className="text-white hover:bg-white/20 hover:text-white"
                            >
                                Login
                            </Button>
                        </Link>
                        <Link to="/signup">
                            <Button className="bg-white text-primary hover:bg-white/90 shadow-lg hover:shadow-white/50 transition-all duration-300 hover:scale-105">
                                Sign Up
                            </Button>
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="md:hidden text-white p-2 hover:bg-white/20 rounded-lg transition-colors"
                        aria-label="Toggle menu"
                    >
                        {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {/* Mobile Navigation */}
                {isMenuOpen && (
                    <div className="md:hidden py-4 space-y-3 animate-slide-down">
                        {navItems.map((item) => (
                            <Link
                                key={item.name}
                                to={item.path}
                                onClick={() => setIsMenuOpen(false)}
                                className="block text-white/90 hover:text-white font-medium py-2 px-4 rounded-lg hover:bg-white/10 transition-all"
                            >
                                {item.name}
                            </Link>
                        ))}
                        <div className="pt-4 space-y-2 border-t border-white/20">
                            <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                                <Button
                                    variant="ghost"
                                    className="w-full text-white hover:bg-white/20"
                                >
                                    Login
                                </Button>
                            </Link>
                            <Link to="/signup" onClick={() => setIsMenuOpen(false)}>
                                <Button className="w-full bg-white text-primary hover:bg-white/90">
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