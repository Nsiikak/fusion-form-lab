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
import { CheckCircle2, Upload, ArrowRight } from "lucide-react";
import logo from "@/assets/plagohive-logo.svg";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";

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
  };

  const handleStep2Next = (data: Step2FormValues) => {
    setFormData({ ...formData, step2: data });
    setStep(3);
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

      toast.success("Vendor registration successful! Your application is pending review.");
      navigate("/vendor-dashboard");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/">
              <img src={logo} alt="Plagohive" className="h-10" />
            </Link>
            <Link to="/vendor-search">
              <Button variant="outline">Back to Search</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          {/* Progress Steps */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center flex-1">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
                    step >= s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {step > s ? <CheckCircle2 className="h-6 w-6" /> : s}
                  </div>
                  {s < 3 && (
                    <div className={`flex-1 h-1 mx-2 ${
                      step > s ? 'bg-primary' : 'bg-muted'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Basic Info</span>
              <span>Service Details</span>
              <span>Verification</span>
            </div>
          </div>

          <Card className="p-8">
            {step === 1 && (
              <Form {...step1Form}>
                <form onSubmit={step1Form.handleSubmit(handleStep1Next)} className="space-y-6">
                  <div>
                    <h2 className="text-3xl font-bold mb-2">Vendor Registration</h2>
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
                            <Input placeholder="Enter your business name" {...field} />
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
                            <Input placeholder="Your full name" {...field} />
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
                            <Input type="email" placeholder="your@email.com" {...field} />
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
                            <Input type="tel" placeholder="+234 XXX XXX XXXX" {...field} />
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
                              <SelectTrigger>
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
                            <Input placeholder="City, State" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" size="lg">
                      Continue
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {step === 2 && (
              <Form {...step2Form}>
                <form onSubmit={step2Form.handleSubmit(handleStep2Next)} className="space-y-6">
                  <div>
                    <h2 className="text-3xl font-bold mb-2">Service Details</h2>
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
                              <Input type="number" placeholder="50000" {...field} />
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
                                <SelectTrigger>
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
                      <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-not-allowed opacity-50">
                        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PNG, JPG up to 10MB
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button onClick={() => setStep(1)} variant="outline" size="lg">
                      Back
                    </Button>
                    <Button type="submit" size="lg">
                      Continue
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {step === 3 && (
              <Form {...step3Form}>
                <form onSubmit={step3Form.handleSubmit(handleSubmit)} className="space-y-6">
                  <div>
                    <h2 className="text-3xl font-bold mb-2">Verification</h2>
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
                            <Input placeholder="CAC Registration Number (optional)" {...field} />
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
                            <Input type="password" placeholder="Enter password" {...field} />
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
                            <Input type="password" placeholder="Confirm password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Upload Business Documents (Coming Soon)</label>
                      <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-not-allowed opacity-50">
                        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Upload CAC certificate, business license, or ID
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PDF, PNG, JPG up to 10MB
                        </p>
                      </div>
                    </div>

                    <div className="bg-accent/10 rounded-lg p-6">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-accent" />
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

                  <div className="flex justify-between">
                    <Button onClick={() => setStep(2)} variant="outline" size="lg" disabled={isSubmitting}>
                      Back
                    </Button>
                    <Button type="submit" size="lg" className="px-8" disabled={isSubmitting}>
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

      <Footer />
    </div>
  );
};

export default VendorRegistration;
