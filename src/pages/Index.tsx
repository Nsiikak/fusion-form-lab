import { useSeo } from "@/lib/seo";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Categories } from "@/components/Categories";
import { OccasionsSection } from "@/components/OccasionsSection";
import { ForCustomers } from "@/components/ForCustomers";
import { ForVendors } from "@/components/ForVendors";
import { TrustSection } from "@/components/TrustSection";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

const Index = () => {
  useSeo({
    title: "Plagohive · Book verified event vendors in Nigeria",
    description: "Book verified caterers, decorators, DJs and more in Lagos. Your payment is held until your event is done, with full refunds if a vendor cancels.",
    path: "/",
    jsonLd: { "@context": "https://schema.org", "@type": "Organization", name: "Plagohive", url: window.location.origin, logo: `${window.location.origin}/icon-512.png` },
  });
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      {/* <TrustedStrip /> — bring back once there are real partners to name */}
      <HowItWorks />
      <Categories />
      <OccasionsSection />
      <ForCustomers />
      <ForVendors />
      <TrustSection />
      {/* <Testimonials /> — bring back with real customer reviews */}
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;
