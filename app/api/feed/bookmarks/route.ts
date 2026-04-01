import { getAuthenticatedUser, createServiceClient } from '@/lib/auth-helpers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { user, profile, error: authError } = await getAuthenticatedUser()

    if (authError || !user || !profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = await request.json()

    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('post_bookmarks')
      .insert({ post_id: postId, user_id: profile.id })

    if (error) {
      // If it already exists (code 23505 is unique violation in Postgres for PK), just return success
      if (error.code === '23505') {
        return NextResponse.json({ success: true, message: 'Already bookmarked' })
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error bookmarking post:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, profile, error: authError } = await getAuthenticatedUser()

    if (authError || !user || !profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = await request.json()

    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('post_bookmarks')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', profile.id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error unbookmarking post:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
