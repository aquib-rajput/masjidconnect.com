import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

// Create Supabase admin client for webhook operations
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

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const eventType = evt.type;

  try {
    switch (eventType) {
      case "user.created": {
        const { id, email_addresses, first_name, last_name, image_url, username } = evt.data;

        const primaryEmail = email_addresses?.find((e) => e.id === evt.data.primary_email_address_id);
        const email = primaryEmail?.email_address;
        const fullName = [first_name, last_name].filter(Boolean).join(" ") || null;

        // Check if profile already exists (by clerk_id or email)
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .or(`clerk_id.eq.${id},email.eq.${email}`)
          .single();

        if (existingProfile) {
          // Update existing profile with Clerk ID
          await supabaseAdmin
            .from("profiles")
            .update({
              clerk_id: id,
              full_name: fullName,
              avatar_url: image_url,
              username: username || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingProfile.id);
        } else {
          // Create new profile
          await supabaseAdmin.from("profiles").insert({
            clerk_id: id,
            email,
            full_name: fullName,
            username: username || null,
            avatar_url: image_url,
            role: "member",
            is_verified: false,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        break;
      }

      case "user.updated": {
        const { id, email_addresses, first_name, last_name, image_url, username } = evt.data;

        const primaryEmail = email_addresses?.find((e) => e.id === evt.data.primary_email_address_id);
        const email = primaryEmail?.email_address;
        const fullName = [first_name, last_name].filter(Boolean).join(" ") || null;

        await supabaseAdmin
          .from("profiles")
          .update({
            email,
            full_name: fullName,
            avatar_url: image_url,
            username: username || null,
            updated_at: new Date().toISOString(),
          })
          .eq("clerk_id", id);

        break;
      }

      case "user.deleted": {
        const { id } = evt.data;

        // Soft delete - mark as inactive instead of deleting
        await supabaseAdmin
          .from("profiles")
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("clerk_id", id);

        break;
      }

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    return new Response("Webhook processed successfully", { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
}
