import { Link } from "react-router-dom";
import { Twitter, Instagram, Linkedin, Facebook } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const platformLinks = [
  { label: "Browse Vendors", to: "/vendor-search" },
  { label: "Plan an Event", to: "/register" },
  { label: "How It Works", to: "/#how-it-works" },
  { label: "Pricing", to: "/#" },
];

const vendorLinks = [
  { label: "Register", to: "/vendor-registration", guestOnly: true },
  { label: "Verification", to: "/#vendors" },
  { label: "Vendor Dashboard", to: "/vendor-dashboard" },
  { label: "Success Stories", to: "/#testimonials" },
];

const companyLinks = [
  { label: "About Plagohive", to: "/#" },
  { label: "Blog", to: "/#" },
  { label: "Privacy Policy", to: "/#" },
  { label: "Contact Us", to: "/#" },
];

export const Footer = () => {
  const { isAuthenticated } = useAuth();

  const columns = [
    { title: "Platform", links: platformLinks },
    {
      title: "Vendors",
      links: vendorLinks.filter((l) => !l.guestOnly || !isAuthenticated),
    },
    { title: "Company", links: companyLinks },
  ];

  return (
    <footer className="bg-foreground pt-[72px] pb-9 px-[5vw]">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-14 mb-14 pb-14 border-b border-white/5">
          {/* Brand */}
          <div>
            <Link to="/" className="inline-flex mb-5">
              <img
                src="/Plagohive.svg"
                alt="Plagohive"
                className="h-9 w-auto block object-contain"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </Link>
            <p className="text-sm text-white/50 leading-[1.75] font-light max-w-xs mb-5">
              Africa's premier marketplace connecting event planners with trusted, verified vendors. Plan your perfect event with confidence.
            </p>
            <div className="flex gap-2">
              {[
                { Icon: Facebook, label: "Facebook" },
                { Icon: Instagram, label: "Instagram" },
                { Icon: Twitter, label: "Twitter" },
                { Icon: Linkedin, label: "LinkedIn" },
              ].map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-9 h-9 rounded-lg bg-white/8 border border-white/12 hover:bg-primary hover:border-primary flex items-center justify-center text-white/55 hover:text-white transition-all duration-200"
                >
                  <Icon className="h-[15px] w-[15px]" />
                </a>
              ))}
            </div>
          </div>

          {/* Columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <div className="text-[11px] font-bold text-white/45 uppercase tracking-[0.06em] mb-4">
                {col.title}
              </div>
              {col.links.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="block text-sm text-white/40 hover:text-white/80 mb-2.5 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="flex flex-wrap justify-between items-center gap-3 text-[13px] text-white/30">
          <span>© {new Date().getFullYear()} Plagohive. All rights reserved.</span>
          <div className="flex gap-5">
            {["Privacy", "Terms", "Cookies"].map((item) => (
              <a
                key={item}
                href="#"
                className="hover:text-white/70 transition-colors"
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};
