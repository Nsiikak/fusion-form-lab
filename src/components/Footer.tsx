import { Facebook, Instagram, Twitter, Linkedin, Mail } from "lucide-react";
import logo from "@/assets/plagohive-logo.jpeg";

export const Footer = () => {
  const footerLinks = {
    Platform: ["How it Works", "Browse Vendors", "Pricing", "Success Stories"],
    "For Vendors": ["Become a Vendor", "Vendor Resources", "Vendor Guidelines", "Support"],
    Company: ["About Us", "Careers", "Press Kit", "Contact"],
    Legal: ["Privacy Policy", "Terms of Service", "Cookie Policy", "Refund Policy"],
  };

  return (
    <footer className="bg-foreground text-white pt-16 pb-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-8 mb-12">
          {/* Brand section */}
          <div className="lg:col-span-2">
            <img 
              src={logo} 
              alt="Plagohive" 
              className="h-12 mb-4 brightness-0 invert"
            />
            <p className="text-white/70 mb-6 text-sm leading-relaxed">
              Africa's premier marketplace connecting event planners with trusted, verified vendors. 
              Plan your perfect event with confidence.
            </p>
            <div className="flex gap-3">
              {[Facebook, Instagram, Twitter, Linkedin].map((Icon, index) => (
                <a
                  key={index}
                  href="#"
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-primary flex items-center justify-center transition-all duration-300 hover:scale-110"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links sections */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="font-bold mb-4 text-white">{title}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a 
                      href="#" 
                      className="text-white/70 hover:text-primary text-sm transition-colors duration-300"
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
            <h3 className="font-bold mb-2 text-white">Stay Updated</h3>
            <p className="text-white/70 text-sm mb-4">
              Get the latest event planning tips and vendor updates
            </p>
            <div className="flex gap-2">
              <div className="flex-1 bg-white/10 rounded-lg px-4 py-3 flex items-center gap-2">
                <Mail className="h-5 w-5 text-white/50" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="bg-transparent border-none outline-none text-white placeholder:text-white/50 text-sm flex-1"
                />
              </div>
              <button className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 hover:scale-105 text-sm">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-white/60">
          <p>© 2024 Plagohive. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
            <a href="#" className="hover:text-primary transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
