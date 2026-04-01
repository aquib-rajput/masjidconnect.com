"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getRealtimeService, ConnectionStatus } from "./realtime-service";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook to get the current realtime connection status
 */
export function useRealtimeStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  useEffect(() => {
    const service = getRealtimeService();
    const unsubscribe = service.subscribeToStatus(setStatus);
    return unsubscribe;
  }, []);

  return status;
}

/**
 * Hook for realtime posts feed subscription
 */
export function useRealtimePosts(
  onNewPost: (post: any) => void,
  onUpdatePost: (post: any) => void,
  onDeletePost: (postId: string) => void
) {
  const supabase = createClient();
  const onNewPostRef = useRef(onNewPost);
  const onUpdatePostRef = useRef(onUpdatePost);
  const onDeletePostRef = useRef(onDeletePost);

  // Keep refs updated
  useEffect(() => {
    onNewPostRef.current = onNewPost;
    onUpdatePostRef.current = onUpdatePost;
    onDeletePostRef.current = onDeletePost;
  }, [onNewPost, onUpdatePost, onDeletePost]);

  useEffect(() => {
    const service = getRealtimeService();

    const unsubscribe = service.subscribeToTable(
      "posts-realtime-v2",
      "posts",
      null,
      // INSERT
      async (payload) => {
        // Fetch full post with author
        const { data: newPost } = await supabase
          .from("posts")
          .select(`*, author:profiles!author_id(id, full_name, avatar_url, username)`)
          .eq("id", payload.new.id)
          .single();

        if (newPost) {
          onNewPostRef.current(newPost);
        }
      },
      // UPDATE
      (payload) => {
        onUpdatePostRef.current(payload.new);
      },
      // DELETE
      (payload) => {
        onDeletePostRef.current(payload.old.id);
      }
    );

    return unsubscribe;
  }, [supabase]);
}

/**
 * Hook for realtime messages subscription
 */
export function useRealtimeMessages(
  conversationId: string | null,
  onNewMessage: (message: any) => void,
  onUpdateMessage?: (message: any) => void,
  onDeleteMessage?: (messageId: string) => void
) {
  const supabase = createClient();
  const onNewMessageRef = useRef(onNewMessage);
  const onUpdateMessageRef = useRef(onUpdateMessage);
  const onDeleteMessageRef = useRef(onDeleteMessage);

  // Keep refs updated
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onUpdateMessageRef.current = onUpdateMessage;
    onDeleteMessageRef.current = onDeleteMessage;
  }, [onNewMessage, onUpdateMessage, onDeleteMessage]);

  useEffect(() => {
    if (!conversationId) return;

    const service = getRealtimeService();

    const unsubscribe = service.subscribeToTable(
      `messages-${conversationId}`,
      "messages",
      `conversation_id=eq.${conversationId}`,
      // INSERT
      async (payload) => {
        // Fetch full message with sender
        const { data: fullMessage } = await supabase
          .from("messages")
          .select(`*, sender:profiles!sender_id(id, full_name, avatar_url)`)
          .eq("id", payload.new.id)
          .single();

        if (fullMessage) {
          onNewMessageRef.current(fullMessage);
        }
      },
      // UPDATE
      (payload) => {
        onUpdateMessageRef.current?.(payload.new);
      },
      // DELETE
      (payload) => {
        onDeleteMessageRef.current?.(payload.old.id);
      }
    );

    return unsubscribe;
  }, [conversationId, supabase]);
}

/**
 * Hook for realtime conversations list subscription
 */
export function useRealtimeConversations(
  userId: string | null,
  onConversationChange: () => void
) {
  const onChangeRef = useRef(onConversationChange);

  useEffect(() => {
    onChangeRef.current = onConversationChange;
  }, [onConversationChange]);

  useEffect(() => {
    if (!userId) return;

    const service = getRealtimeService();

    // Subscribe to both messages and conversations tables
    const unsubscribe = service.subscribeToMultipleTables(
      `conversations-list-${userId}`,
      [
        {
          table: "messages",
          onInsert: () => onChangeRef.current(),
        },
        {
          table: "conversations",
          onInsert: () => onChangeRef.current(),
          onUpdate: () => onChangeRef.current(),
          onDelete: () => onChangeRef.current(),
        },
        {
          table: "conversation_participants",
          onInsert: () => onChangeRef.current(),
          onDelete: () => onChangeRef.current(),
        },
      ]
    );

    return unsubscribe;
  }, [userId]);
}

/**
 * Hook for realtime post comments subscription
 */
export function useRealtimeComments(
  postId: string | null,
  onNewComment: (comment: any) => void,
  onDeleteComment?: (commentId: string) => void
) {
  const supabase = createClient();
  const onNewCommentRef = useRef(onNewComment);
  const onDeleteCommentRef = useRef(onDeleteComment);

  useEffect(() => {
    onNewCommentRef.current = onNewComment;
    onDeleteCommentRef.current = onDeleteComment;
  }, [onNewComment, onDeleteComment]);

  useEffect(() => {
    if (!postId) return;

    const service = getRealtimeService();

    const unsubscribe = service.subscribeToTable(
      `comments-${postId}`,
      "post_comments",
      `post_id=eq.${postId}`,
      // INSERT
      async (payload) => {
        const { data: fullComment } = await supabase
          .from("post_comments")
          .select(`*, author:profiles!author_id(id, full_name, avatar_url)`)
          .eq("id", payload.new.id)
          .single();

        if (fullComment) {
          onNewCommentRef.current(fullComment);
        }
      },
      // UPDATE - not used for comments
      undefined,
      // DELETE
      (payload) => {
        onDeleteCommentRef.current?.(payload.old.id);
      }
    );

    return unsubscribe;
  }, [postId, supabase]);
}

/**
 * Hook for optimistic updates with rollback
 */
export function useOptimisticUpdate<T>() {
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, T>>(new Map());

  const addPendingUpdate = useCallback((id: string, data: T) => {
    setPendingUpdates((prev) => {
      const next = new Map(prev);
      next.set(id, data);
      return next;
    });
  }, []);

  const removePendingUpdate = useCallback((id: string) => {
    setPendingUpdates((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const rollbackUpdate = useCallback((id: string) => {
    // Just remove from pending - the UI should revert to server state
    removePendingUpdate(id);
  }, [removePendingUpdate]);

  return {
    pendingUpdates,
    addPendingUpdate,
    removePendingUpdate,
    rollbackUpdate,
    hasPending: (id: string) => pendingUpdates.has(id),
  };
}
