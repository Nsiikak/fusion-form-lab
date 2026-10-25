import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Search, Home, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const NotFound = () => {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const dashboardPath = user?.role === "vendor" ? "/vendor-dashboard" : "/customer-dashboard";

  useEffect(() => {
    console.error("404:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-20" style={{ background: "var(--gradient-hero)" }}>
      <Link to="/" className="mb-10">
        <img src="/Plagohive.svg" alt="Plagohive" className="w-auto object-contain h-7 sm:h-8" />
      </Link>

      <div className="text-center max-w-md">
        <div
          className="inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-6 text-5xl font-extrabold text-primary shadow-lg"
          style={{ background: "hsl(var(--primary-light))" }}
        >
          404
        </div>
        <h1 className="text-3xl font-extrabold text-foreground mb-3 tracking-tight">Page not found</h1>
        <p className="text-muted-foreground text-[15px] leading-relaxed mb-8">
          The page <span className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded text-foreground">{location.pathname}</span> doesn't exist or may have moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <Link to="/">
            <Button className="w-full sm:w-auto h-11 px-6 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl">
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </Link>
          <Link to="/vendor-search">
            <Button variant="outline" className="w-full sm:w-auto h-11 px-6 font-semibold rounded-xl">
              <Search className="h-4 w-4 mr-2" />
              Browse Vendors
            </Button>
          </Link>
          {isAuthenticated && (
            <Link to={dashboardPath}>
              <Button variant="ghost" className="w-full sm:w-auto h-11 px-6 font-semibold rounded-xl">
                <ArrowLeft className="h-4 w-4 mr-2" />
                My Dashboard
              </Button>
            </Link>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Looking for something specific?{" "}
          <Link to="/vendor-search" className="text-primary hover:underline font-medium">
            Search vendors
          </Link>{" "}
          or{" "}
          <Link to="/" className="text-primary hover:underline font-medium">
            return to the homepage
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

export default NotFound;
