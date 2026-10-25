import { Link, useLocation } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

interface NavLink {
  to: string;
  label: string;
}

interface Props {
  links: NavLink[];
  displayName: string;
  subtitle?: string;
  onLogout: () => void;
}

/** Header for signed-in dashboards. Desktop: inline links. Phone: avatar menu with the same
 *  links plus logout (the old headers hid everything below md, leaving no way to log out). */
export const DashboardHeader = ({ links, displayName, subtitle, onLogout }: Props) => {
  const { pathname } = useLocation();
  const unread = useUnreadMessages();
  const badge = (to: string) =>
    to === "/messages" && unread > 0 ? (
      <span className="ml-1.5 inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full bg-primary text-white text-[11px] font-bold">
        {unread > 9 ? "9+" : unread}
      </span>
    ) : null;
  const initial = displayName?.trim()?.[0]?.toUpperCase() || "U";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-border/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex-shrink-0">
          <img src="/Plagohive.svg" alt="Plagohive" className="w-auto object-contain h-7 sm:h-8" />
        </Link>

        {/* Desktop */}
        <nav className="hidden md:flex items-center gap-2">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "text-sm font-medium px-3 py-1.5 rounded-full transition-colors",
                pathname.startsWith(l.to) ? "text-primary bg-primary/10" : "text-foreground/70 hover:text-primary",
              )}
            >
              {l.label}
              {badge(l.to)}
            </Link>
          ))}
          <span className="flex items-center gap-2 pl-3 ml-1 border-l border-border text-sm text-muted-foreground">
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-semibold">
              {initial}
            </span>
            <span className="max-w-[160px] truncate">{displayName}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
            <LogOut className="h-4 w-4 mr-1.5" /> Logout
          </Button>
        </nav>

        {/* Phone */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="md:hidden flex items-center gap-2 rounded-full border border-border bg-white pl-1 pr-3 py-1 shadow-sm active:scale-[0.98] transition"
              aria-label="Open menu"
            >
              <span className="relative w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-sm font-semibold">
                {initial}
                {unread > 0 && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-celebrate-emerald ring-2 ring-white" />}
              </span>
              <Menu className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-xl">
            <DropdownMenuLabel className="font-normal">
              <p className="font-semibold truncate">{displayName}</p>
              {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {links.map((l) => (
              <DropdownMenuItem key={l.to} asChild className={cn("py-2.5", pathname === l.to && "text-primary font-medium")}>
                <Link to={l.to}>{l.label}{badge(l.to)}</Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="py-2.5 text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default DashboardHeader;
