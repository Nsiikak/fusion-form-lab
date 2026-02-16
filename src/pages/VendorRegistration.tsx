import { useState } from "react";
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
import { CheckCircle2, Upload, ArrowRight, Building2, User, Mail, Phone, MapPin, DollarSign, FileText } from "lucide-react";
import logo from "@/assets/plagohive-logo.svg";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

// Step 1 schema
const step1Schema = z.object({
  business_name: z.string().min(1, "Business name is required"),
  contact_name: z.string().min(1, "Contact name is required"),
  email: z.string().email("Invalid email address"),
  phone_number: z.string().min(1, "Phone number is required"),
  category: z.enum(["catering", "decoration", "photography", "entertainment", "logistics", "venue"]),
  location: z.string().min(1, "Location is required"),
});

// Step 2 schema
const step2Schema = z.object({
  description: z.string().min(10, "Description must be at least 10 characters"),
  starting_price: z.string().min(1, "Starting price is required").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "Must be a valid positive number"
  ),
  business_size: z.enum(["small", "medium", "large"]),
});

// Step 3 schema
const step3Schema = z.object({
  registration_number: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type Step1FormValues = z.infer<typeof step1Schema>;
type Step2FormValues = z.infer<typeof step2Schema>;
type Step3FormValues = z.infer<typeof step3Schema>;

const VendorRegistration = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
              <img src={logo} alt="Plagohive" className="h-10" />
            </Link>
            <Link to="/vendor-search">
              <Button variant="outline" className="border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors">Back to Search</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="pt-32 pb-16 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-20 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl relative z-10">
          {/* Progress Steps */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4 relative">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center flex-1 z-10">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold shadow-lg transition-all duration-300 ${step >= s ? 'bg-gradient-to-br from-primary to-primary-glow text-white scale-110' : 'bg-muted text-muted-foreground'
                    }`}>
                    {step > s ? <CheckCircle2 className="h-6 w-6" /> : s}
                  </div>
                  {s < 3 && (
                    <div className={`flex-1 h-1 mx-4 rounded-full transition-all duration-500 ${step > s ? 'bg-gradient-to-r from-primary to-primary-glow' : 'bg-muted'
                      }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span className={step >= 1 ? "text-primary" : "text-muted-foreground"}>Basic Info</span>
              <span className={step >= 2 ? "text-primary" : "text-muted-foreground"}>Service Details</span>
              <span className={step >= 3 ? "text-primary" : "text-muted-foreground"}>Verification</span>
            </div>
          </div>

          <Card className="glass-panel p-8 md:p-12 animate-fade-in-up">
            {step === 1 && (
              <Form {...step1Form}>
                <form onSubmit={step1Form.handleSubmit(handleStep1Next)} className="space-y-8">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">Vendor Registration</h2>
                    <p className="text-muted-foreground">Let's get started with your basic information</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={step1Form.control}
                      name="business_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Name *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Building2 className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                              <Input placeholder="Enter your business name" className="pl-10 h-12 glass-input" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={step1Form.control}
                      name="contact_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Name *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                              <Input placeholder="Your full name" className="pl-10 h-12 glass-input" {...field} />
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
                          <FormLabel>Email Address *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                              <Input type="email" placeholder="your@email.com" className="pl-10 h-12 glass-input" {...field} />
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
                          <FormLabel>Phone Number *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                              <Input type="tel" placeholder="+234 XXX XXX XXXX" className="pl-10 h-12 glass-input" {...field} />
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
                          <FormLabel>Business Category *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="glass-input h-12">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="catering">Catering</SelectItem>
                              <SelectItem value="decoration">Decoration</SelectItem>
                              <SelectItem value="photography">Photography</SelectItem>
                              <SelectItem value="entertainment">Entertainment</SelectItem>
                              <SelectItem value="logistics">Logistics</SelectItem>
                              <SelectItem value="venue">Venue</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={step1Form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <MapPin className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                              <Input placeholder="City, State" className="pl-10 h-12 glass-input" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button type="submit" size="lg" className="px-8 shadow-lg hover:shadow-primary/50 transition-all duration-300">
                      Continue
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {step === 2 && (
              <Form {...step2Form}>
                <form onSubmit={step2Form.handleSubmit(handleStep2Next)} className="space-y-8">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">Service Details</h2>
                    <p className="text-muted-foreground">Tell us about your services and pricing</p>
                  </div>

                  <div className="space-y-6">
                    <FormField
                      control={step2Form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Description *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe your services, what makes you unique..."
                              rows={5}
                              className="glass-input min-h-[120px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={step2Form.control}
                        name="starting_price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Starting Price (₦) *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                                <Input type="number" placeholder="50000" className="pl-10 h-12 glass-input" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={step2Form.control}
                        name="business_size"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Size *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="glass-input h-12">
                                  <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="small">Small Scale</SelectItem>
                                <SelectItem value="medium">Medium Scale</SelectItem>
                                <SelectItem value="large">Large Scale</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Upload Service Photos (Coming Soon)</label>
                      <div className="border-2 border-dashed border-primary/20 bg-primary/5 rounded-xl p-8 text-center hover:border-primary/50 transition-all cursor-not-allowed opacity-70 group">
                        <Upload className="h-12 w-12 mx-auto mb-4 text-primary group-hover:scale-110 transition-transform" />
                        <p className="text-sm font-medium text-foreground">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PNG, JPG up to 10MB
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
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

            {step === 3 && (
              <Form {...step3Form}>
                <form onSubmit={step3Form.handleSubmit(handleSubmit)} className="space-y-8">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">Verification</h2>
                    <p className="text-muted-foreground">Help us verify your business</p>
                  </div>

                  <div className="space-y-6">
                    <FormField
                      control={step3Form.control}
                      name="registration_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Registration Number</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FileText className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                              <Input placeholder="CAC Registration Number (optional)" className="pl-10 h-12 glass-input" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={step3Form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Create Password *</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter password" className="h-12 glass-input" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={step3Form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password *</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Confirm password" className="h-12 glass-input" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Upload Business Documents (Coming Soon)</label>
                      <div className="border-2 border-dashed border-primary/20 bg-primary/5 rounded-xl p-8 text-center hover:border-primary/50 transition-all cursor-not-allowed opacity-70 group">
                        <Upload className="h-12 w-12 mx-auto mb-4 text-primary group-hover:scale-110 transition-transform" />
                        <p className="text-sm font-medium text-foreground">
                          Upload CAC certificate, business license, or ID
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PDF, PNG, JPG up to 10MB
                        </p>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6">
                      <h3 className="font-semibold mb-2 flex items-center gap-2 text-green-700">
                        <CheckCircle2 className="h-5 w-5" />
                        What happens next?
                      </h3>
                      <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                        <li>• Our team will review your application within 48 hours</li>
                        <li>• You'll receive an email once approved</li>
                        <li>• Start receiving bookings immediately after approval</li>
                        <li>• Get featured as a verified vendor on the platform</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button onClick={() => setStep(2)} variant="outline" size="lg" className="border-primary/20 hover:bg-primary/5" disabled={isSubmitting}>
                      Back
                    </Button>
                    <Button type="submit" size="lg" className="px-8 shadow-lg hover:shadow-primary/50 transition-all duration-300" disabled={isSubmitting}>
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
