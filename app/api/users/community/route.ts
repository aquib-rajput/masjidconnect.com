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

    // Get community members (limit to 20)
    const { data: members, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, bio, profession, role')
      .neq('id', profile.id)
      .limit(20)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching members:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: members || [] })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
