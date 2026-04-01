import { getAuthenticatedUser, createServiceClient } from '@/lib/auth-helpers'
import { type NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, profile, error: authError } = await getAuthenticatedUser()

    if (authError || !user || !profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await params
    const supabase = createServiceClient()

    // 1. Check if user is a participant OR an admin
    const { data: participation, error: partError } = await supabase
      .from('conversation_participants')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', profile.id)
      .maybeSingle()

    if (partError || !participation) {
      return NextResponse.json({ error: 'Conversation access denied or not found' }, { status: 403 })
    }

    // 2. Delete the conversation (Cascade will handle participants and messages)
    const { error: deleteError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)

    if (deleteError) {
      console.error('Error deleting conversation:', deleteError)
      return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
