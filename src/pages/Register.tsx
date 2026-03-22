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
import { ArrowRight, Mail, Lock, User, Phone, Loader2 } from "lucide-react";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  full_name: z.string().optional(),
  phone_number: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const Register = () => {
  const navigate = useNavigate();
  const { register: registerUser, isLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      full_name: "",
      phone_number: "",
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      const { confirmPassword, ...registerData } = data;
      // Always set role to customer for regular registration
      await registerUser({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        phone_number: data.phone_number,
        role: "customer"
      });
      toast.success("Registration successful!");
      navigate("/customer-dashboard");
    } catch (error: any) {
      toast.error(error.message || "Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-primary via-primary-glow to-accent bg-[length:200%_200%] animate-gradient-shift py-10">
      {/* Animated Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-20 left-10 w-72 h-72 bg-accent/20 rounded-full blur-3xl animate-float" />
      </div>

      <div className="w-full max-w-lg p-4 relative z-10 animate-fade-in-up">
        <div className="mb-8 text-center space-y-2">
          <Link to="/" className="inline-block transition-transform hover:scale-105">
            <img src={logo} alt="Plagohive" className="h-16 mx-auto mb-6 drop-shadow-2xl" />
          </Link>
          <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-md">
            Create an account
          </h1>
          <p className="text-white/90 text-lg font-medium">
            Join thousands of users today
          </p>
        </div>

        <Card className="p-8 shadow-2xl backdrop-blur-xl bg-white/10 border-white/20">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-white font-medium">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3.5 h-5 w-5 text-white/70" />
                          <Input
                            type="password"
                            placeholder="Min 6 chars"
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
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-white font-medium">Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3.5 h-5 w-5 text-white/70" />
                          <Input
                            type="password"
                            placeholder="Re-enter password"
                            className="pl-10 h-12 bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30 focus:border-white/50"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-200" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-white font-medium">Full Name (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-3.5 h-5 w-5 text-white/70" />
                        <Input
                          placeholder="Your full name"
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
                name="phone_number"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-white font-medium">Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3.5 h-5 w-5 text-white/70" />
                        <Input
                          placeholder="+234 XXX XXX XXXX"
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
                className="w-full h-12 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 mt-2"
                disabled={isSubmitting || isLoading}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Create account <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm">
            <span className="text-white/80">Already have an account? </span>
            <Link to="/login" className="text-white font-bold hover:underline decoration-2 underline-offset-4 decoration-secondary">
              Sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Register;

