import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

type ProfileSummary = {
  id: string;
  role: string | null;
};

type ClerkClaimsMap = Record<string, unknown>;

export type ClaimIdentity = {
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
};

export type DatabaseIdentity = {
  databaseUserId: string;
  role: string | null;
};

function getStringClaim(claims: ClerkClaimsMap, key: string) {
  const value = claims[key];
  return typeof value === "string" ? value : null;
}

function normalizeClaims(claims: unknown) {
  if (!claims || typeof claims !== "object") {
    return {} as ClerkClaimsMap;
  }

  return claims as ClerkClaimsMap;
}

export function getIdentityFromClaims(claims: unknown): ClaimIdentity {
  const normalized = normalizeClaims(claims);
  const email = getStringClaim(normalized, "email");
  const fullName =
    getStringClaim(normalized, "full_name") ??
    getStringClaim(normalized, "name");
  const avatarUrl = getStringClaim(normalized, "picture");
  const emailVerified = Boolean(normalized.email_verified);

  return {
    email,
    fullName,
    avatarUrl,
    emailVerified,
  };
}

async function findProfileByEmail(email: string): Promise<ProfileSummary | null> {
  const admin = createAdminClient();
  if (!admin) {
    return null;
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("Failed to find profile by email:", error.message);
    return null;
  }

  return data;
}

async function createProfileForClerkUser({
  email,
  fullName,
  avatarUrl,
}: {
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
}): Promise<ProfileSummary | null> {
  const admin = createAdminClient();
  if (!admin) {
    return null;
  }

  const { data, error } = await admin
    .from("profiles")
    .insert({
      email,
      full_name: fullName,
      avatar_url: avatarUrl,
      role: "member",
    })
    .select("id, role")
    .single();

  if (error) {
    console.error("Failed to create profile for Clerk user:", error.message);
    return null;
  }

  return data;
}

async function findProfileById(profileId: string): Promise<ProfileSummary | null> {
  const admin = createAdminClient();
  if (!admin) {
    return null;
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    console.error("Failed to find profile by id:", error.message);
    return null;
  }

  return data;
}

export async function resolveDatabaseIdentity({
  clerkUserId,
  email,
  fullName,
  avatarUrl,
  ensureProfile = false,
}: {
  clerkUserId: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  ensureProfile?: boolean;
}): Promise<DatabaseIdentity> {
  let profile: ProfileSummary | null = null;

  if (email) {
    profile = await findProfileByEmail(email);

    if (!profile && ensureProfile) {
      profile = await createProfileForClerkUser({
        email,
        fullName,
        avatarUrl,
      });
    }
  }

  if (!profile) {
    profile = await findProfileById(clerkUserId);
  }

  return {
    databaseUserId: profile?.id ?? clerkUserId,
    role: profile?.role ?? null,
  };
}

export function toSupabaseCompatibleUser({
  databaseUserId,
  clerkUserId,
  email,
  fullName,
  avatarUrl,
  emailVerified,
}: {
  databaseUserId: string;
  clerkUserId: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
}): User {
  return {
    id: databaseUserId,
    email,
    email_confirmed_at: emailVerified ? new Date().toISOString() : null,
    user_metadata: {
      full_name: fullName,
      avatar_url: avatarUrl,
      clerk_id: clerkUserId,
    },
  } as unknown as User;
}

