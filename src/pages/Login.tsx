import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");
  const { login, isLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      const user = await login(data.email, data.password);
      toast.success("Welcome back!");
      if (redirect) {
        navigate(redirect);
      } else if (user.role === "vendor") {
        navigate("/vendor-dashboard");
      } else {
        navigate("/customer-dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Login failed. Please check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans">
      {/* ── Left panel – dark brand canvas ── */}
      <div className="hidden lg:flex lg:w-[52%] bg-[#0D1B2A] flex-col justify-between p-14 relative overflow-hidden">

        {/* Geometric background – hive-inspired hexagons */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.07]"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Grid of hexagons at various sizes */}
          {[
            { cx: 120, cy: 120, r: 90 },
            { cx: 340, cy: 60, r: 60 },
            { cx: 80, cy: 320, r: 50 },
            { cx: 280, cy: 260, r: 110 },
            { cx: 460, cy: 160, r: 70 },
            { cx: 160, cy: 520, r: 80 },
            { cx: 400, cy: 440, r: 55 },
            { cx: 520, cy: 340, r: 40 },
            { cx: 60, cy: 640, r: 45 },
            { cx: 300, cy: 600, r: 70 },
            { cx: 480, cy: 580, r: 50 },
          ].map((h, i) => (
            <polygon
              key={i}
              points={hexPoints(h.cx, h.cy, h.r)}
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
          ))}
        </svg>

        {/* Brand accent blob */}
        <div
          className="absolute top-[-80px] right-[-80px] w-[320px] h-[320px] rounded-full opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(29 100% 48%) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-60px] left-[-60px] w-[260px] h-[260px] rounded-full opacity-15 pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(210 79% 42%) 0%, transparent 70%)" }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <Link to="/" className="inline-flex">
            <img src="/Plagohive.svg" alt="Plagohive" className="h-9 w-auto block object-contain" style={{ filter: "brightness(0) invert(1)" }} />
          </Link>
        </div>

        {/* Main copy */}
        <div className="relative z-10">
          <p className="text-accent text-sm font-bold uppercase tracking-widest mb-5">
            Africa's Event Marketplace
          </p>
          <h2
            className="font-display font-extrabold text-white leading-[1.05] mb-7"
            style={{ fontSize: "clamp(32px, 3.2vw, 48px)", letterSpacing: "-0.03em" }}
          >
            Plan events<br />people will never<br />stop talking about.
          </h2>

          <div className="flex flex-col gap-4 mb-12">
            {[
              { stat: "1,000+", label: "Verified vendors" },
              { stat: "5,000+", label: "Events planned" },
              { stat: "4.8★",   label: "Average rating" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-4">
                <span className="font-display text-2xl font-extrabold text-white">{s.stat}</span>
                <span className="text-white/40 text-sm">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Trust strip */}
          <div className="border-t border-white/10 pt-6">
            <p className="text-white/30 text-xs font-medium uppercase tracking-widest">
              Secure · Verified · Africa-first
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-white/25 text-xs">
          © {new Date().getFullYear()} Plagohive. All rights reserved.
        </p>
      </div>

      {/* ── Right panel – form ── */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 md:px-14 py-6">
          {/* Mobile logo */}
          <Link to="/" className="lg:hidden inline-flex">
            <img src="/Plagohive.svg" alt="Plagohive" className="h-10 w-auto block object-contain" />
          </Link>
          <div className="hidden lg:block" />

          <p className="text-sm text-muted-foreground">
            No account?{" "}
            <Link to="/register" className="text-primary font-semibold hover:underline">
              Sign up free
            </Link>
          </p>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-8 md:px-14 pb-16">
          <div className="w-full max-w-[400px]">

            {/* Heading */}
            <div className="mb-10">
              <h1
                className="font-display font-extrabold text-foreground mb-2 leading-tight"
                style={{ fontSize: "clamp(28px, 2.5vw, 38px)", letterSpacing: "-0.03em" }}
              >
                Welcome back.
              </h1>
              <p className="text-muted-foreground text-[15px]">
                Enter your credentials to access your account.
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-foreground">
                        Email address
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          className="h-12 rounded-xl border-border/80 focus-visible:ring-primary/30 text-[15px] px-4"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-sm font-semibold text-foreground">
                          Password
                        </FormLabel>
                        <Link
                          to="/forgot-password"
                          className="text-xs text-primary hover:underline font-medium"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="h-12 rounded-xl border-border/80 focus-visible:ring-primary/30 text-[15px] px-4"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-12 bg-primary hover:bg-[hsl(var(--primary-glow))] text-white font-bold rounded-xl text-[15px] transition-all hover:-translate-y-px shadow-[var(--shadow-primary)] hover:shadow-[var(--shadow-primary-lg)] mt-1"
                  disabled={isSubmitting || isLoading}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </Form>

            {/* Vendor CTA */}
            <div className="mt-10 pt-8 border-t border-border/60">
              <p className="text-[13px] text-muted-foreground mb-3">
                Are you an event vendor?
              </p>
              <Link to="/vendor-registration">
                <Button
                  variant="outline"
                  className="w-full h-11 rounded-xl border-border text-sm font-semibold hover:bg-[hsl(var(--primary-light))] hover:border-primary hover:text-primary transition-all"
                >
                  Register your business →
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(" ");
}

export default Login;
