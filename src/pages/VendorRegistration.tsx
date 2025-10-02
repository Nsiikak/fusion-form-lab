import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Footer } from "@/components/Footer";
import { CheckCircle2, Upload, ArrowRight } from "lucide-react";
import logo from "@/assets/plagohive-logo.svg";
import { Link } from "react-router-dom";

const VendorRegistration = () => {
  const [step, setStep] = useState(1);

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
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold mb-2">Vendor Registration</h2>
                  <p className="text-muted-foreground">Let's get started with your basic information</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Business Name *</Label>
                    <Input placeholder="Enter your business name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Name *</Label>
                    <Input placeholder="Your full name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email Address *</Label>
                    <Input type="email" placeholder="your@email.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number *</Label>
                    <Input type="tel" placeholder="+234 XXX XXX XXXX" />
                  </div>
                  <div className="space-y-2">
                    <Label>Business Category *</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="catering">Catering</SelectItem>
                        <SelectItem value="decoration">Decoration</SelectItem>
                        <SelectItem value="photography">Photography</SelectItem>
                        <SelectItem value="entertainment">Entertainment</SelectItem>
                        <SelectItem value="logistics">Logistics</SelectItem>
                        <SelectItem value="venue">Venue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Location *</Label>
                    <Input placeholder="City, State" />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => setStep(2)} size="lg">
                    Continue
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold mb-2">Service Details</h2>
                  <p className="text-muted-foreground">Tell us about your services and pricing</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Service Description *</Label>
                    <Textarea 
                      placeholder="Describe your services, what makes you unique..."
                      rows={5}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Starting Price (₦) *</Label>
                      <Input type="number" placeholder="50000" />
                    </div>
                    <div className="space-y-2">
                      <Label>Business Size *</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Small Scale</SelectItem>
                          <SelectItem value="medium">Medium Scale</SelectItem>
                          <SelectItem value="large">Large Scale</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Upload Service Photos</Label>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
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
                  <Button onClick={() => setStep(3)} size="lg">
                    Continue
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold mb-2">Verification</h2>
                  <p className="text-muted-foreground">Help us verify your business</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Business Registration Number</Label>
                    <Input placeholder="CAC Registration Number (optional)" />
                  </div>

                  <div className="space-y-2">
                    <Label>Upload Business Documents</Label>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
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
                  <Button onClick={() => setStep(2)} variant="outline" size="lg">
                    Back
                  </Button>
                  <Button size="lg" className="px-8">
                    Submit Application
                    <CheckCircle2 className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default VendorRegistration;
