import { Facebook, Instagram, Twitter, Linkedin, Mail } from "lucide-react";

const footerLinks: Record<string, string[]> = {
  Platform: ["How it Works", "Browse Vendors", "Pricing", "Success Stories"],
  "For Vendors": ["Become a Vendor", "Vendor Resources", "Vendor Guidelines", "Support"],
  Company: ["About Us", "Careers", "Press Kit", "Contact"],
  Legal: ["Privacy Policy", "Terms of Service", "Cookie Policy", "Refund Policy"],
};

export const Footer = () => {
  return (
    <footer className="bg-foreground text-white pt-14 pb-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-8 mb-10">
          {/* Brand section */}
          <div className="lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">
              Plagohive
            </p>
            <p className="text-white/60 mb-6 text-sm leading-relaxed max-w-xs">
              Africa's premier marketplace connecting event planners with trusted, verified vendors.
              Plan your perfect event with confidence.
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
                  className="w-9 h-9 rounded-lg bg-white/8 hover:bg-primary flex items-center justify-center transition-colors duration-200"
                >
                  <Icon className="h-4 w-4 text-white/70" />
                </a>
              ))}
            </div>
          </div>

          {/* Links sections */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">{title}</h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-white/60 hover:text-white text-sm transition-colors duration-200"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <div className="border-t border-white/10 pt-8 mb-8">
          <div className="max-w-md">
            <h3 className="font-semibold mb-1 text-white text-sm">Stay Updated</h3>
            <p className="text-white/50 text-xs mb-4">
              Get the latest event planning tips and vendor updates
            </p>
            <div className="flex gap-2">
              <div className="flex-1 bg-white/8 border border-white/10 rounded-lg px-4 py-2.5 flex items-center gap-2 focus-within:border-white/25 transition-colors duration-200">
                <Mail className="h-4 w-4 text-white/40 flex-shrink-0" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  aria-label="Email for newsletter"
                  className="bg-transparent border-none outline-none text-white placeholder:text-white/35 text-sm flex-1"
                />
              </div>
              <button className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg font-medium transition-colors duration-200 text-sm">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-white/35">
          <p>© 2026 Plagohive. All rights reserved.</p>
          <div className="flex gap-5">
            {["Privacy", "Terms", "Cookies"].map((item) => (
              <a key={item} href="#" className="hover:text-white/70 transition-colors duration-200">
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};
