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
import { toast } from "sonner";
import { ArrowLeft, Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";

const schema = z.object({
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[A-Za-z]/, "Must include at least one letter")
    .regex(/[0-9]/, "Must include at least one number")
    .regex(/[^A-Za-z0-9]/, "Must include at least one special character"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormValues = z.infer<typeof schema>;

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
          <h2 className="text-xl font-bold mb-3">Invalid reset link</h2>
          <p className="text-muted-foreground text-sm mb-6">
            This link is invalid or has expired. Request a new one.
          </p>
          <Link to="/forgot-password">
            <Button className="w-full">Request New Link</Button>
          </Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: FormValues) => {
    try {
      await api.auth.resetPassword(token, data.password);
      setDone(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (error: any) {
      const msg = error.response?.data?.detail || "Reset failed. The link may have expired.";
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <Link to="/" className="flex justify-center mb-10">
          <img
            src="/Plagohive.svg"
            alt="Plagohive"
            className="h-10 w-auto object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </Link>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          {done ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="h-8 w-8 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Password updated!</h1>
              <p className="text-muted-foreground text-sm">
                Redirecting you to sign in...
              </p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold mb-1">Set new password</h1>
                <p className="text-muted-foreground text-sm">
                  Must be at least 8 characters with letters, numbers, and a special character.
                </p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">New password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPw ? "text" : "password"}
                              placeholder="••••••••"
                              className="h-12 rounded-xl pr-10"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPw(!showPw)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Confirm password</FormLabel>
                        <FormControl>
                          <Input
                            type={showPw ? "text" : "password"}
                            placeholder="••••••••"
                            className="h-12 rounded-xl"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "Update Password"
                    )}
                  </Button>
                </form>
              </Form>

              <div className="mt-6 text-center">
                <Link to="/login" className="text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
