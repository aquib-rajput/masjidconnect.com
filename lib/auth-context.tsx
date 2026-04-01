"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useUser, useAuth as useClerkAuth } from "@clerk/nextjs";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "admin" | "shura" | "imam" | "member";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
  role: UserRole;
  mosque_id: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: { id: string; email?: string } | null;
  session: { id: string } | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isShura: boolean;
  isImam: boolean;
  isMember: boolean;
  hasRole: (roles: UserRole[]) => boolean;
  isSignedIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { signOut: clerkSignOut, getToken } = useClerkAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Simplified user object compatible with existing code
  const user = clerkUser
    ? {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress,
      }
    : null;

  // Simplified session object
  const session = isSignedIn ? { id: clerkUser?.id || "" } : null;

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("clerk_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching profile:", error);
        return null;
      }

      return data as Profile | null;
    } catch (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (clerkUser) {
      const profileData = await fetchProfile(clerkUser.id);
      setProfile(profileData);
    }
  }, [clerkUser, fetchProfile]);

  // Update user online status every 30 seconds
  useEffect(() => {
    if (!clerkUser) return;

    const updateStatus = async () => {
      try {
        await fetch('/api/users/status', { method: 'POST' });
      } catch (error) {
        console.error('Error updating status:', error);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 30000);

    return () => clearInterval(interval);
  }, [clerkUser]);

  // Fetch profile when Clerk user changes
  useEffect(() => {
    const loadProfile = async () => {
      if (clerkLoaded) {
        if (clerkUser) {
          const profileData = await fetchProfile(clerkUser.id);
          setProfile(profileData);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    };

    loadProfile();
  }, [clerkLoaded, clerkUser, fetchProfile]);

  const signOut = async () => {
    await clerkSignOut();
    setProfile(null);
  };

  const hasRole = (roles: UserRole[]) => {
    if (!profile) return false;
    return roles.includes(profile.role);
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading: !clerkLoaded || loading,
    signOut,
    refreshProfile,
    isAdmin: profile?.role === "admin",
    isShura: profile?.role === "shura",
    isImam: profile?.role === "imam",
    isMember: profile?.role === "member",
    hasRole,
    isSignedIn: !!isSignedIn,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
