import { getAuthenticatedUser, createServiceClient } from '@/lib/auth-helpers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const { user, profile, error: authError } = await getAuthenticatedUser()

    if (authError || !user || !profile) {
      // Not authenticated - silently return success to avoid spamming errors
      return NextResponse.json({ success: false, reason: 'not_authenticated' })
    }

    const supabase = createServiceClient()

    // Update user's last_seen_at timestamp
    const { error } = await supabase
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', profile.id)

    if (error) {
      console.error('Error updating status:', error)
      return NextResponse.json({ success: false, reason: error.message })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Status update error:', error)
    return NextResponse.json({ success: false, reason: 'internal_error' })
  }
}
