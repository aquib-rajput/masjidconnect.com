import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

// Create Supabase admin client for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export interface AuthenticatedUser {
  clerkId: string;
  profileId: string;
  email: string | null;
  fullName: string | null;
  role: string;
}

/**
 * Get the authenticated user from Clerk and their Supabase profile
 * Returns null if not authenticated
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  // Get the Clerk user
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  // Get or create the Supabase profile
  let { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("clerk_id", userId)
    .single();

  // If profile doesn't exist, create it
  if (error?.code === "PGRST116" || !profile) {
    const email = clerkUser.primaryEmailAddress?.emailAddress || null;
    const fullName = [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(" ");

    const { data: newProfile, error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        clerk_id: userId,
        email,
        full_name: fullName || null,
        username: clerkUser.username || null,
        avatar_url: clerkUser.imageUrl || null,
        role: "member",
        is_verified: false,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id, role")
      .single();

    if (insertError) {
      console.error("Error creating profile:", insertError);
      return null;
    }

    profile = newProfile;
  }

  return {
    clerkId: userId,
    profileId: profile.id,
    email: clerkUser.primaryEmailAddress?.emailAddress || null,
    fullName:
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      null,
    role: profile.role,
  };
}

/**
 * Get the Supabase admin client for server-side operations
 */
export function getSupabaseAdmin() {
  return supabaseAdmin;
}

/**
 * Check if user has one of the required roles
 */
export function hasRole(
  user: AuthenticatedUser | null,
  roles: string[]
): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
