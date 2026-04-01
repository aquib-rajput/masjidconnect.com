"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { Building2 } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="text-muted-foreground mt-2">
            Sign in to your MosqueConnect account
          </p>
        </div>

        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-none border rounded-xl bg-card",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton:
                "border-input bg-background hover:bg-muted",
              formButtonPrimary:
                "bg-primary hover:bg-primary/90 text-primary-foreground",
              footerActionLink: "text-primary hover:text-primary/90",
              formFieldInput: "border-input bg-background",
              formFieldLabel: "text-foreground",
              identityPreviewEditButton: "text-primary",
              formResendCodeLink: "text-primary",
            },
          }}
          routing="path"
          path="/auth/login"
          signUpUrl="/auth/sign-up"
          forceRedirectUrl="/feed"
        />

        <div className="text-xs text-center text-muted-foreground mt-6">
          <Link href="/" className="hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
