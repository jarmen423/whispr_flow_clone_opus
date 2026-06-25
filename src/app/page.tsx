"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/landing/navbar";
import HeroSection from "@/components/landing/hero-section";
import FeatureShowcase from "@/components/landing/feature-showcase";
import CTASections from "@/components/landing/cta-sections";
import Footer from "@/components/landing/footer";

export default function LandingPage() {
  const [user, setUser] = useState<{ name: string | null; email: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <Navbar user={user} setUser={setUser} />
      <HeroSection />
      <FeatureShowcase />
      <CTASections user={user} />
      <Footer />
    </main>
  );
}
