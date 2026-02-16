import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
import logo from "@/assets/plagohive-logo.svg";
import { ArrowRight, Mail, Lock, Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const Login = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
      toast.success("Welcome back!");
      navigate("/customer-dashboard");
    } catch (error: any) {
      toast.error(error.message || "Login failed. Please check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-primary via-primary-glow to-accent bg-[length:200%_200%] animate-gradient-shift">
      {/* Animated Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-secondary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float-slow" />
      </div>

      <div className="w-full max-w-md p-4 relative z-10 animate-fade-in-up">
        <div className="mb-8 text-center space-y-2">
          <Link to="/" className="inline-block transition-transform hover:scale-105">
            <img src={logo} alt="Plagohive" className="h-16 mx-auto mb-6 drop-shadow-2xl" />
          </Link>
          <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-md">
            Welcome back
          </h1>
          <p className="text-white/90 text-lg font-medium">
            Enter your credentials to access your workspace
          </p>
        </div>

        <Card className="p-8 shadow-2xl backdrop-blur-xl bg-white/10 border-white/20">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-white font-medium">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3.5 h-5 w-5 text-white/70" />
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          className="pl-10 h-12 bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30 focus:border-white/50"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-200" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-white font-medium">Password</FormLabel>
                      <Link
                        to="/forgot-password"
                        className="text-xs text-white/90 hover:text-white hover:underline transition-colors"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3.5 h-5 w-5 text-white/70" />
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="pl-10 h-12 bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30 focus:border-white/50"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-200" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-12 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                disabled={isSubmitting || isLoading}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Sign in <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-8 text-center text-sm">
            <span className="text-white/80">New to Plagohive? </span>
            <Link to="/register" className="text-white font-bold hover:underline decoration-2 underline-offset-4 decoration-secondary">
              Create an account
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;

