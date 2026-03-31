import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getIdentityFromClaims, resolveDatabaseIdentity, toSupabaseCompatibleUser } from "@/lib/auth/server";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseServerKey = supabaseServiceRoleKey || supabaseAnonKey;

  if (!supabaseUrl || !supabaseServerKey) {
    throw new Error('Missing Supabase environment variables');
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseServerKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

  (supabase.auth as { getUser: () => Promise<{ data: { user: unknown }; error: null }> }).getUser = async () => {
    const authState = await auth();

    if (!authState.userId) {
      return { data: { user: null }, error: null };
    }

    let { email, fullName, avatarUrl, emailVerified } = getIdentityFromClaims(
      authState.sessionClaims
    );

    if (!email || !fullName || !avatarUrl) {
      const clerkUser = await currentUser();

      email = email ?? clerkUser?.primaryEmailAddress?.emailAddress ?? null;
      fullName = fullName ?? clerkUser?.fullName ?? null;
      avatarUrl = avatarUrl ?? clerkUser?.imageUrl ?? null;
      emailVerified =
        emailVerified ||
        clerkUser?.primaryEmailAddress?.verification?.status === "verified";
    }

    const { databaseUserId } = await resolveDatabaseIdentity({
      clerkUserId: authState.userId,
      email,
      fullName,
      avatarUrl,
      ensureProfile: true,
    });

    const user = toSupabaseCompatibleUser({
      databaseUserId,
      clerkUserId: authState.userId,
      email,
      fullName,
      avatarUrl,
      emailVerified,
    });

    return { data: { user }, error: null };
  };

  return supabase;
}
