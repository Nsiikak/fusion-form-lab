import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Footer } from "@/components/Footer";
import {
  CheckCircle2,
  Upload,
  ArrowRight,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Banknote,
  FileText,
  Briefcase,
  Shield,
  Check,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

const step1Schema = z.object({
  business_name: z.string().min(1, "Business name is required"),
  contact_name: z.string().min(1, "Contact name is required"),
  email: z.string().email("Invalid email address"),
  phone_number: z.string().min(1, "Phone number is required"),
  category: z.enum(["catering", "decoration", "photography", "entertainment", "logistics", "venue"]),
  location: z.string().min(1, "Location is required"),
});

const step2Schema = z.object({
  description: z.string().min(10, "Description must be at least 10 characters"),
  starting_price: z.string().min(1, "Starting price is required").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "Must be a valid positive number"
  ),
  business_size: z.enum(["small", "medium", "large"]),
});

const step3Schema = z.object({
  registration_number: z.string().min(1, "RC number is required for automatic verification"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[A-Za-z]/, "Must include at least one letter")
    .regex(/[0-9]/, "Must include at least one number")
    .regex(/[^A-Za-z0-9]/, "Must include at least one special character"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type Step1FormValues = z.infer<typeof step1Schema>;
type Step2FormValues = z.infer<typeof step2Schema>;
type Step3FormValues = z.infer<typeof step3Schema>;

const CATEGORIES = [
  { value: "catering", label: "Catering" },
  { value: "decoration", label: "Decoration" },
  { value: "photography", label: "Photography" },
  { value: "entertainment", label: "Entertainment" },
  { value: "logistics", label: "Logistics" },
  { value: "venue", label: "Venue" },
];

const SectionDivider = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3 my-2">
    <div className="h-px flex-1 bg-border" />
    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1">
      {label}
    </span>
    <div className="h-px flex-1 bg-border" />
  </div>
);

const StepHeader = ({
  step,
  icon: Icon,
  title,
  subtitle,
}: {
  step: number;
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) => (
  <div className="flex items-center gap-4 mb-8 p-5 bg-gradient-to-r from-primary/10 to-accent/5 rounded-2xl border border-primary/10">
    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] flex items-center justify-center shadow-lg flex-shrink-0">
      <Icon className="h-7 w-7 text-white" />
    </div>
    <div>
      <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-0.5">
        Step {step} of 3
      </p>
      <h2 className="text-xl font-bold text-foreground leading-tight">{title}</h2>
      <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  </div>
);

const PwCheck = ({ met, label }: { met: boolean; label: string }) => (
  <span className={`flex items-center gap-1.5 text-xs ${met ? "text-green-600" : "text-muted-foreground"}`}>
    {met ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 opacity-40" />}
    {label}
  </span>
);

const VendorRegistration = () => {
  const navigate = useNavigate();
  const { refreshUser, isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    if (user?.role === "vendor") {
      navigate("/vendor-dashboard", { replace: true });
    } else if (user?.role === "customer") {
      navigate("/customer-dashboard", { replace: true });
    }
  }, [isAuthenticated, user?.role]);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<{
    step1?: Step1FormValues;
    step2?: Step2FormValues;
    step3?: Step3FormValues;
  }>({});

  const step1Form = useForm<Step1FormValues>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      business_name: "",
      contact_name: "",
      email: "",
      phone_number: "",
      category: "catering",
      location: "",
    },
  });

  const step2Form = useForm<Step2FormValues>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      description: "",
      starting_price: "",
      business_size: "small",
    },
  });

  const step3Form = useForm<Step3FormValues>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      registration_number: "",
      password: "",
      confirmPassword: "",
    },
  });

  const passwordValue = step3Form.watch("password") ?? "";
  const pwChecks = {
    length: passwordValue.length >= 8,
    letter: /[A-Za-z]/.test(passwordValue),
    number: /[0-9]/.test(passwordValue),
    special: /[^A-Za-z0-9]/.test(passwordValue),
  };

  const handleStep1Next = (data: Step1FormValues) => {
    setFormData({ ...formData, step1: data });
    setStep(2);
    window.scrollTo(0, 0);
  };

  const handleStep2Next = (data: Step2FormValues) => {
    setFormData({ ...formData, step2: data });
    setStep(3);
    window.scrollTo(0, 0);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedPhotos((prev) => [...prev, ...files].slice(0, 5));
  };

  const removeSelectedPhoto = (index: number) => {
    setSelectedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (data: Step3FormValues) => {
    setIsSubmitting(true);
    try {
      const allData = {
        ...formData.step1!,
        ...formData.step2!,
        ...data,
      };

      await api.vendors.register({
        email: allData.email,
        password: allData.password,
        business_name: allData.business_name,
        contact_name: allData.contact_name,
        category: allData.category,
        location: allData.location,
        description: allData.description,
        starting_price: Number(allData.starting_price),
        business_size: allData.business_size,
        registration_number: allData.registration_number || undefined,
        phone_number: allData.phone_number,
      });

      await refreshUser();

      if (selectedPhotos.length > 0) {
        try {
          for (const photo of selectedPhotos) {
            await api.vendors.uploadImage(photo, "gallery");
          }
        } catch {
          toast.warning("Registered! Some photos failed to upload — you can add them from your profile.");
        }
      }

      toast.success("Vendor registration successful! Your application is pending review.");
      navigate("/vendor-dashboard");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/">
              <img src="/Plagohive.svg" alt="Plagohive" className="h-12 w-auto object-contain" />
            </Link>
            <Link to="/vendor-search">
              <Button variant="outline" className="border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors">
                Back to Search
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="pt-32 pb-16 relative overflow-hidden">
        <div className="absolute top-20 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl relative z-10">
          {/* Progress Steps */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3 relative">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center flex-1 z-10">
                  <div
                    className={`flex items-center justify-center w-11 h-11 rounded-full font-bold shadow-md transition-all duration-300 ${
                      step >= s
                        ? "bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] text-white scale-110"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
                  </div>
                  {s < 3 && (
                    <div
                      className={`flex-1 h-1 mx-3 rounded-full transition-all duration-500 ${
                        step > s ? "bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))]" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs font-semibold">
              <span className={step >= 1 ? "text-primary" : "text-muted-foreground"}>Basic Info</span>
              <span className={step >= 2 ? "text-primary" : "text-muted-foreground"}>Service Details</span>
              <span className={step >= 3 ? "text-primary" : "text-muted-foreground"}>Verification</span>
            </div>
          </div>

          <Card className="glass-panel p-6 md:p-10 animate-fade-in-up">
            {/* ── STEP 1 ── */}
            {step === 1 && (
              <Form {...step1Form}>
                <form onSubmit={step1Form.handleSubmit(handleStep1Next)} className="space-y-6">
                  <StepHeader
                    step={1}
                    icon={Building2}
                    title="Business Information"
                    subtitle="Tell us about your business and how customers can reach you"
                  />

                  <SectionDivider label="Business Identity" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormField
                      control={step1Form.control}
                      name="business_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Name <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Building2 className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="e.g. Bright Events Catering" className="pl-10 h-11 glass-input" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={step1Form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Category <span className="text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="glass-input h-11">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CATEGORIES.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <SectionDivider label="Contact Information" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormField
                      control={step1Form.control}
                      name="contact_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Person <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="Your full name" className="pl-10 h-11 glass-input" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={step1Form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                              <Input type="email" placeholder="your@email.com" className="pl-10 h-11 glass-input" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={step1Form.control}
                      name="phone_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                              <Input type="tel" placeholder="+234 XXX XXX XXXX" className="pl-10 h-11 glass-input" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={step1Form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <div className="relative">
                              <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="City, State (e.g. Lagos, Lagos)" className="pl-10 h-11 glass-input" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button type="submit" size="lg" className="px-8 shadow-lg hover:shadow-primary/50 transition-all duration-300">
                      Continue
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <Form {...step2Form}>
                <form onSubmit={step2Form.handleSubmit(handleStep2Next)} className="space-y-6">
                  <StepHeader
                    step={2}
                    icon={Briefcase}
                    title="Service Details"
                    subtitle="Describe what you offer and how you price your services"
                  />

                  <SectionDivider label="What You Offer" />

                  <FormField
                    control={step2Form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Description <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your services, your experience, and what makes you stand out from the competition..."
                            rows={5}
                            className="glass-input min-h-[120px] resize-none"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground mt-1">
                          This appears on your public profile. Be specific — mention your specialties, years of experience, and typical event types.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <SectionDivider label="Pricing & Scale" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormField
                      control={step2Form.control}
                      name="starting_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base Rate (₦) <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Banknote className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                              <Input type="number" placeholder="50000" className="pl-10 h-11 glass-input" {...field} />
                            </div>
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">
                            Charged on every booking. Add-on services are priced separately from your dashboard.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={step2Form.control}
                      name="business_size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Scale <span className="text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="glass-input h-11">
                                <SelectValue placeholder="Select scale" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="small">Small Scale (1–10 staff)</SelectItem>
                              <SelectItem value="medium">Medium Scale (11–50 staff)</SelectItem>
                              <SelectItem value="large">Large Scale (50+ staff)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Base rate explainer */}
                  <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 space-y-3">
                    <p className="text-xs font-bold text-primary uppercase tracking-widest">What is a base rate?</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Your base rate is charged on <span className="font-semibold text-foreground">every booking</span> — it covers your time, travel, and setup regardless of what services the customer selects. Think of it as your engagement fee.
                    </p>
                    <div className="space-y-2.5">
                      {[
                        {
                          type: "DJ / Photographer",
                          tip: "Set your full service fee as the base rate. Customers pay one flat price — no add-ons needed.",
                        },
                        {
                          type: "Caterer / Bar service",
                          tip: "Set a small setup fee (e.g. ₦20,000). Then list your menu items (Rice, Cocktails…) as priced services from your dashboard — customers pick what they want.",
                        },
                        {
                          type: "Decorator / Venue",
                          tip: "Set your minimum engagement fee here. Add package tiers or specific décor items as services after sign-up.",
                        },
                      ].map(({ type, tip }) => (
                        <div key={type} className="flex gap-2.5 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                          <span>
                            <span className="font-semibold text-foreground">{type}:</span>{" "}
                            <span className="text-muted-foreground">{tip}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <SectionDivider label="Portfolio Photos" />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Upload up to 5 photos showcasing your work <span className="text-xs">(optional)</span>
                      </p>
                      {selectedPhotos.length > 0 && (
                        <span className="text-xs text-primary font-medium">
                          {selectedPhotos.length} / 5 added
                        </span>
                      )}
                    </div>

                    {selectedPhotos.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {selectedPhotos.map((file, i) => (
                          <div key={i} className="relative group aspect-square">
                            <img
                              src={URL.createObjectURL(file)}
                              alt=""
                              className="w-full h-full object-cover rounded-xl border border-border"
                            />
                            <button
                              type="button"
                              onClick={() => removeSelectedPhoto(i)}
                              className="absolute top-1 right-1 bg-black/60 hover:bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedPhotos.length < 5 && (
                      <label className="block border-2 border-dashed border-primary/20 bg-primary/5 rounded-xl p-6 text-center hover:border-primary/40 hover:bg-primary/10 transition-all cursor-pointer group">
                        <Upload className="h-9 w-9 mx-auto mb-2.5 text-primary/60 group-hover:text-primary group-hover:scale-110 transition-all" />
                        <p className="text-sm font-medium text-foreground">Click to upload photos</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP — up to 5 MB each</p>
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="hidden"
                          onChange={handlePhotoSelect}
                        />
                      </label>
                    )}
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button onClick={() => setStep(1)} variant="outline" size="lg" className="border-primary/20 hover:bg-primary/5">
                      Back
                    </Button>
                    <Button type="submit" size="lg" className="px-8 shadow-lg hover:shadow-primary/50 transition-all duration-300">
                      Continue
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
              <Form {...step3Form}>
                <form onSubmit={step3Form.handleSubmit(handleSubmit)} className="space-y-6">
                  <StepHeader
                    step={3}
                    icon={Shield}
                    title="Business Verification"
                    subtitle="Verify your business and secure your account"
                  />

                  <SectionDivider label="CAC Verification" />

                  <FormField
                    control={step3Form.control}
                    name="registration_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          CAC Registration Number (RC Number) <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <FileText className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="e.g. RC1234567" className="pl-10 h-11 glass-input" {...field} />
                          </div>
                        </FormControl>
                        <p className="text-xs text-muted-foreground mt-1">
                          Your RC number is automatically cross-checked with the CAC database. Matching businesses are approved instantly.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-5">
                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-700 text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      What happens after submission?
                    </h3>
                    <ul className="space-y-1.5 text-sm text-muted-foreground ml-6">
                      <li>• Your RC number is checked against the CAC database automatically</li>
                      <li>
                        • If your business name matches, you're{" "}
                        <span className="font-semibold text-green-700">approved instantly</span>
                      </li>
                      <li>• Mismatches are reviewed by our team within 48 hours</li>
                      <li>• Verified vendors appear in search and can start receiving bookings</li>
                    </ul>
                  </div>

                  <SectionDivider label="Account Security" />

                  <div className="space-y-5">
                    <FormField
                      control={step3Form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Create Password <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter a strong password" className="h-11 glass-input" {...field} />
                          </FormControl>
                          {/* Live requirements checklist */}
                          <div className="grid grid-cols-2 gap-1.5 mt-2 p-3 bg-muted/50 rounded-lg border border-border">
                            <PwCheck met={pwChecks.length} label="8+ characters" />
                            <PwCheck met={pwChecks.letter} label="One letter" />
                            <PwCheck met={pwChecks.number} label="One number" />
                            <PwCheck met={pwChecks.special} label="One special character" />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={step3Form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Re-enter your password" className="h-11 glass-input" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button
                      onClick={() => setStep(2)}
                      variant="outline"
                      size="lg"
                      className="border-primary/20 hover:bg-primary/5"
                      disabled={isSubmitting}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      size="lg"
                      className="px-8 shadow-lg hover:shadow-primary/50 transition-all duration-300"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Submitting..." : "Submit Application"}
                      {!isSubmitting && <CheckCircle2 className="ml-2 h-5 w-5" />}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
};

export default VendorRegistration;
