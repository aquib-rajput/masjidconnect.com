"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth as useClerkAuth, useUser } from "@clerk/nextjs";

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

export interface AuthUser {
  id: string;
  clerk_id: string;
  email: string | null;
  email_confirmed_at: string | null;
  user_metadata?: {
    full_name?: string | null;
    avatar_url?: string | null;
  };
}

export interface AuthSession {
  id: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isShura: boolean;
  isImam: boolean;
  isMember: boolean;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const { isLoaded, userId, sessionId, signOut: clerkSignOut } = useClerkAuth();
  const { user: clerkUser } = useUser();

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/profile", {
        cache: "no-store",
      });

      if (response.status === 401) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status}`);
      }

      const payload = await response.json();
      return (payload.profile ?? null) as Profile | null;
    } catch (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;

    const profileData = await fetchProfile();

    if (profileData?.id && profileData.id !== user.id) {
      setUser((previous) =>
        previous
          ? {
              ...previous,
              id: profileData.id,
            }
          : previous
      );
    }

    setProfile(profileData);
  }, [fetchProfile, user]);

  // Update user online status every 30 seconds
  useEffect(() => {
    if (!user) return;

    const updateStatus = async () => {
      try {
        await fetch("/api/users/status", { method: "POST" });
      } catch (error) {
        console.error("Error updating status:", error);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 30000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const syncAuthState = async () => {
      if (!isLoaded) {
        return;
      }

      if (!userId) {
        setUser(null);
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
        const profileData = await fetchProfile();
        const effectiveUserId = profileData?.id ?? userId;
        const emailVerified =
          clerkUser?.primaryEmailAddress?.verification?.status === "verified";

        setSession({ id: sessionId ?? null });
        setUser({
          id: effectiveUserId,
          clerk_id: userId,
          email: primaryEmail,
          email_confirmed_at: emailVerified ? new Date().toISOString() : null,
          user_metadata: {
            full_name: clerkUser?.fullName ?? null,
            avatar_url: clerkUser?.imageUrl ?? null,
          },
        });
        setProfile(profileData);
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        setLoading(false);
      }
    };

    void syncAuthState();
  }, [clerkUser, fetchProfile, isLoaded, sessionId, userId]);

  const signOut = async () => {
    await clerkSignOut();
    setUser(null);
    setSession(null);
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
    loading,
    signOut,
    refreshProfile,
    isAdmin: profile?.role === "admin",
    isShura: profile?.role === "shura",
    isImam: profile?.role === "imam",
    isMember: profile?.role === "member",
    hasRole,
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
