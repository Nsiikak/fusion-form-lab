import { Link, useLocation } from "react-router-dom";
import { CalendarHeart, CalendarCheck, MessageCircle, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/vendor-search", label: "Explore", icon: Search, match: ["/vendor-search", "/find"] },
  { to: "/plan", label: "Plan", icon: CalendarHeart, match: ["/plan"] },
  { to: "/messages", label: "Messages", icon: MessageCircle, match: ["/messages"] },
  { to: "/customer-dashboard", label: "Bookings", icon: CalendarCheck, match: ["/customer-dashboard"] },
];
// Pages with their own bottom bar (booking, chat composer) keep it to themselves
const HIDE = [/^\/vendors\//, /^\/messages\/\d+/, /^\/admin/, /^\/vendor-/, /^\/profile/, /^\/login/, /^\/register/];

/** Phone-only tab bar for signed-in customers: the app's main places one tap away. */
const CustomerBottomNav = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const unread = useUnreadMessages();
  if (user?.role !== "customer" || HIDE.some((r) => r.test(pathname))) return null;
  return (
    <>
      <div className="h-16 md:hidden" aria-hidden />
      <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-4">
          {TABS.map(({ to, label, icon: Icon, match }) => {
            const on = match.some((m) => pathname.startsWith(m));
            return (
              <li key={to}>
                <Link to={to} aria-current={on ? "page" : undefined}
                  className={cn("relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold", on ? "text-primary" : "text-muted-foreground")}>
                  <Icon className="h-5 w-5" />
                  {label}
                  {to === "/messages" && unread > 0 && <span className="absolute top-1.5 right-[30%] h-2 w-2 rounded-full bg-primary" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
};

export default CustomerBottomNav;
