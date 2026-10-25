import { Link } from "react-router-dom";
import { Twitter, Instagram, Linkedin, Facebook } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const platformLinks = [
  { label: "Browse Vendors", to: "/vendor-search" },
  { label: "Plan an Event", to: "/register" },
  { label: "How It Works", to: "/", anchor: "how-it-works" },
];

const companyLinks = [
  { label: "About Plagohive", to: null },
  { label: "Blog", to: null },
  { label: "Privacy Policy", to: null },
  { label: "Contact Us", to: null },
];

const socials = [
  { Icon: Facebook, label: "Facebook" },
  { Icon: Instagram, label: "Instagram" },
  { Icon: Twitter, label: "Twitter / X" },
  { Icon: Linkedin, label: "LinkedIn" },
];

export const Footer = () => {
  const { isAuthenticated, user } = useAuth();
  const isVendor = user?.role === "vendor";

  const vendorLinks = [
    ...(!isAuthenticated ? [{ label: "Register as Vendor", to: "/vendor-registration" }] : []),
    ...(isVendor ? [{ label: "Vendor Dashboard", to: "/vendor-dashboard" }] : []),
    { label: "How Verification Works", to: null, anchor: "vendors" },
    { label: "Success Stories", to: null, anchor: "testimonials" },
  ];

  const columns = [
    { title: "Platform", links: platformLinks },
    { title: "Vendors", links: vendorLinks },
    { title: "Company", links: companyLinks },
  ];

  const handleAnchorClick = (anchor: string) => {
    if (window.location.pathname === "/") {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" });
    } else {
      window.location.href = `/#${anchor}`;
    }
  };

  return (
    <footer className="bg-[#0D1B2A] pt-[72px] pb-9 px-[5vw]">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-10 mb-14 pb-14 border-b border-white/5">
          {/* Brand */}
          <div>
            <Link to="/" className="inline-flex mb-5">
              <img
                src="/Plagohive.svg"
                alt="Plagohive"
                className="w-auto block object-contain h-7 sm:h-8"
                style={{ filter: "brightness(0) invert(1)" }}
                loading="lazy"
              />
            </Link>
            <p className="text-sm text-white/50 leading-[1.75] font-light max-w-xs mb-5">
              Africa's premier marketplace connecting event planners with trusted, verified vendors. Plan your perfect event with confidence.
            </p>
            {/* Social icons — coming soon */}
            <div className="flex gap-2">
              {socials.map(({ Icon, label }) => (
                <span
                  key={label}
                  title={`${label} — coming soon`}
                  className="w-9 h-9 rounded-lg bg-white/8 border border-white/12 flex items-center justify-center text-white/30 cursor-default"
                  aria-label={`${label} (coming soon)`}
                >
                  <Icon className="h-[15px] w-[15px]" />
                </span>
              ))}
            </div>
          </div>

          {/* Columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <div className="text-[11px] font-bold text-white/45 uppercase tracking-[0.06em] mb-4">
                {col.title}
              </div>
              {col.links.map((link) => {
                if ((link as any).anchor && !(link as any).to) {
                  return (
                    <button
                      key={link.label}
                      onClick={() => handleAnchorClick((link as any).anchor)}
                      className="block text-sm text-white/40 hover:text-white/80 mb-2.5 transition-colors text-left w-full"
                    >
                      {link.label}
                    </button>
                  );
                }
                if ((link as any).anchor && (link as any).to) {
                  return (
                    <button
                      key={link.label}
                      onClick={() => handleAnchorClick((link as any).anchor)}
                      className="block text-sm text-white/40 hover:text-white/80 mb-2.5 transition-colors text-left w-full"
                    >
                      {link.label}
                    </button>
                  );
                }
                if (!link.to) {
                  return (
                    <span key={link.label} className="block text-sm text-white/20 mb-2.5 cursor-default">
                      {link.label}
                      <span className="ml-1.5 text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/30">Soon</span>
                    </span>
                  );
                }
                return (
                  <Link
                    key={link.label}
                    to={link.to}
                    className="block text-sm text-white/40 hover:text-white/80 mb-2.5 transition-colors"
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="flex flex-wrap justify-between items-center gap-3 text-[13px] text-white/30">
          <span>© {new Date().getFullYear()} Plagohive. All rights reserved.</span>
          <div className="flex gap-5">
            {["Privacy", "Terms", "Cookies"].map((item) => (
              <span key={item} className="cursor-default hover:text-white/50 transition-colors">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};
