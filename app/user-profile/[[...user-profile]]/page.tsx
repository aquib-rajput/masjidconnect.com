"use client";

import { UserProfile } from "@clerk/nextjs";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default function UserProfilePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
          <UserProfile
            path="/user-profile"
            routing="path"
            appearance={{
              elements: {
                card: "shadow-none border-border/40",
              },
            }}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
