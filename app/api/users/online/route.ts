import { getAuthenticatedUser, createServiceClient } from '@/lib/auth-helpers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, profile, error: authError } = await getAuthenticatedUser()

    if (authError || !user || !profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Get online users (active in last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60000).toISOString()
    
    const { data: onlineUsers, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, bio, profession, role')
      .neq('id', profile.id)
      .gte('last_seen_at', fiveMinutesAgo)
      .limit(10)
      .order('last_seen_at', { ascending: false })

    if (error) {
      console.error('Error fetching online users:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: onlineUsers || [] })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
