import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { ValueProposition } from "@/components/ValueProposition";
import { HowItWorks } from "@/components/HowItWorks";
import { Categories } from "@/components/Categories";
import { TrustSection } from "@/components/TrustSection";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <ValueProposition />
      <HowItWorks />
      <Categories />
      <TrustSection />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;
