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
import { ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[A-Za-z]/, "Must include at least one letter")
    .regex(/[0-9]/, "Must include at least one number")
    .regex(/[^A-Za-z0-9]/, "Must include at least one special character"),
  confirmPassword: z.string(),
  full_name: z.string().optional(),
  phone_number: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(" ");
}

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");
  const { register: registerUser, isLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwValue, setPwValue] = useState("");

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "", full_name: "", phone_number: "" },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      const user = await registerUser({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        phone_number: data.phone_number,
        role: "customer",
      });
      toast.success("Account created successfully!");
      if (redirect) {
        navigate(redirect);
      } else if (user.role === "vendor") {
        navigate("/vendor-dashboard");
      } else {
        navigate("/customer-dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans">
      {/* ── Left panel – dark brand canvas ── */}
      <div className="hidden lg:flex lg:w-[52%] bg-[#0D1B2A] flex-col justify-between p-14 relative overflow-hidden">

        {/* Geometric hive background */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.07]"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {[
            { cx: 80,  cy: 80,  r: 70 },
            { cx: 300, cy: 40,  r: 50 },
            { cx: 200, cy: 200, r: 100 },
            { cx: 440, cy: 120, r: 65 },
            { cx: 60,  cy: 300, r: 45 },
            { cx: 360, cy: 280, r: 80 },
            { cx: 140, cy: 460, r: 60 },
            { cx: 480, cy: 400, r: 55 },
            { cx: 260, cy: 520, r: 75 },
            { cx: 60,  cy: 580, r: 40 },
            { cx: 420, cy: 560, r: 45 },
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

        <div
          className="absolute top-[-60px] right-[-60px] w-[280px] h-[280px] rounded-full opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(210 79% 42%) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-80px] left-[-80px] w-[300px] h-[300px] rounded-full opacity-15 pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(29 100% 48%) 0%, transparent 70%)" }}
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
            Join the community
          </p>
          <h2
            className="font-display font-extrabold text-white leading-[1.05] mb-7"
            style={{ fontSize: "clamp(32px, 3.2vw, 48px)", letterSpacing: "-0.03em" }}
          >
            Find vendors you<br />can actually trust.<br />
            <span className="text-primary">Every time.</span>
          </h2>

          <div className="flex flex-col gap-5 mb-12">
            {[
              { icon: "🔍", text: "Browse thousands of verified vendors" },
              { icon: "⭐", text: "Read authentic, confirmed reviews" },
              { icon: "🔒", text: "Secure payments and booking protection" },
            ].map((item) => (
              <div key={item.text} className="flex items-start gap-3.5">
                <span className="text-lg leading-none mt-0.5">{item.icon}</span>
                <span className="text-white/65 text-[14.5px] leading-snug">{item.text}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-6">
            <p className="text-white/30 text-xs font-medium uppercase tracking-widest">
              Free to join · No credit card required
            </p>
          </div>
        </div>

        <p className="relative z-10 text-white/25 text-xs">
          © {new Date().getFullYear()} Plagohive. All rights reserved.
        </p>
      </div>

      {/* ── Right panel – form ── */}
      <div className="flex-1 flex flex-col bg-white overflow-y-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 md:px-14 py-6 flex-shrink-0">
          <Link to="/" className="lg:hidden inline-flex">
            <img src="/Plagohive.svg" alt="Plagohive" className="h-10 w-auto block object-contain" />
          </Link>
          <div className="hidden lg:block" />
          <p className="text-sm text-muted-foreground">
            Have an account?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-8 md:px-14 pb-16 pt-4">
          <div className="w-full max-w-[400px]">

            <div className="mb-8">
              <h1
                className="font-display font-extrabold text-foreground mb-2 leading-tight"
                style={{ fontSize: "clamp(26px, 2.5vw, 36px)", letterSpacing: "-0.03em" }}
              >
                Create your account.
              </h1>
              <p className="text-muted-foreground text-[15px]">
                It's free — join thousands of event planners today.
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-foreground">Full name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Your full name"
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-foreground">Email address</FormLabel>
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
                  name="phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-foreground">
                        Phone number{" "}
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+234 XXX XXX XXXX"
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
                      <FormLabel className="text-sm font-semibold text-foreground">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Min 8 chars, with number & symbol"
                            className="h-12 rounded-xl border-border/80 focus-visible:ring-primary/30 text-[15px] px-4 pr-11"
                            {...field}
                            onChange={(e) => { field.onChange(e); setPwValue(e.target.value); }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      {/* Live strength indicator */}
                      {pwValue && (() => {
                        const checks = [
                          pwValue.length >= 8,
                          /[A-Za-z]/.test(pwValue),
                          /[0-9]/.test(pwValue),
                          /[^A-Za-z0-9]/.test(pwValue),
                        ];
                        const passed = checks.filter(Boolean).length;
                        const colors = ["bg-destructive", "bg-orange-400", "bg-yellow-400", "bg-green-500"];
                        const labels = ["Too weak", "Weak", "Fair", "Strong"];
                        return (
                          <div className="mt-1.5 space-y-1">
                            <div className="flex gap-1">
                              {checks.map((ok, i) => (
                                <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < passed ? colors[passed - 1] : "bg-muted"}`} />
                              ))}
                            </div>
                            <div className="flex gap-3 text-[11px] text-muted-foreground">
                              <span className={pwValue.length >= 8 ? "text-green-600" : ""}>8+ chars</span>
                              <span className={/[0-9]/.test(pwValue) ? "text-green-600" : ""}>Number</span>
                              <span className={/[^A-Za-z0-9]/.test(pwValue) ? "text-green-600" : ""}>Symbol</span>
                              <span className={`ml-auto font-medium ${passed >= 3 ? "text-green-600" : "text-muted-foreground"}`}>{labels[passed - 1] ?? ""}</span>
                            </div>
                          </div>
                        );
                      })()}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-foreground">Confirm password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirm ? "text" : "password"}
                            placeholder="Re-enter your password"
                            className="h-12 rounded-xl border-border/80 focus-visible:ring-primary/30 text-[15px] px-4 pr-11"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showConfirm ? "Hide password" : "Show password"}
                          >
                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
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
                      Create account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </Form>

            <div className="mt-8 pt-7 border-t border-border/60">
              <p className="text-[13px] text-muted-foreground mb-3">Are you an event vendor?</p>
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

export default Register;
