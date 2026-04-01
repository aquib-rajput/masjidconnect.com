import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, createServiceClient } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const { user, profile, error } = await getAuthenticatedUser();
    
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, profile: currentProfile, error: authError } = await getAuthenticatedUser();
    
    if (authError || !user || !currentProfile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { full_name, username, avatar_url, phone, bio } = body;

    // Only allow updating certain fields
    const updateData: Record<string, unknown> = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (username !== undefined) updateData.username = username;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (phone !== undefined) updateData.phone = phone;
    if (bio !== undefined) updateData.bio = bio;

    const supabase = createServiceClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", currentProfile.id)
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation on username
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
