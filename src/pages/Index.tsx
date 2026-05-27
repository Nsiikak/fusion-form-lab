import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { TrustedStrip } from "@/components/TrustedStrip";
import { HowItWorks } from "@/components/HowItWorks";
import { Categories } from "@/components/Categories";
import { ForCustomers } from "@/components/ForCustomers";
import { ForVendors } from "@/components/ForVendors";
import { TrustSection } from "@/components/TrustSection";
import { Testimonials } from "@/components/Testimonials";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <TrustedStrip />
      <HowItWorks />
      <Categories />
      <ForCustomers />
      <ForVendors />
      <TrustSection />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;
