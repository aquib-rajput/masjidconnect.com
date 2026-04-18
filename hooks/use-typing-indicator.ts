"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRealtime } from "@/lib/realtime/realtime-context";

interface UseTypingIndicatorOptions {
  conversationId: string;
  debounceMs?: number;
}

export function useTypingIndicator({ 
  conversationId, 
  debounceMs = 2000 
}: UseTypingIndicatorOptions) {
  const { setTyping, getTypingUsers, subscribeToTyping } = useRealtime();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Subscribe to typing updates for this conversation
  useEffect(() => {
    const unsubscribe = subscribeToTyping(conversationId);
    return () => {
      unsubscribe();
      // Stop typing when leaving the conversation
      if (isTypingRef.current) {
        setTyping(conversationId, false);
      }
    };
  }, [conversationId, subscribeToTyping, setTyping]);

  // Handle typing start
  const handleTypingStart = useCallback(() => {
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Start typing if not already
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      setTyping(conversationId, true);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      setTyping(conversationId, false);
    }, debounceMs);
  }, [conversationId, debounceMs, setTyping]);

  // Handle typing stop (call when message is sent)
  const handleTypingStop = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      setTyping(conversationId, false);
    }
  }, [conversationId, setTyping]);

  // Get currently typing users (excluding self)
  const typingUsers = getTypingUsers(conversationId);

  // Format typing indicator text
  const typingText = (() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].user_name} is typing...`;
    if (typingUsers.length === 2) {
      return `${typingUsers[0].user_name} and ${typingUsers[1].user_name} are typing...`;
    }
    return `${typingUsers.length} people are typing...`;
  })();

  return {
    handleTypingStart,
    handleTypingStop,
    typingUsers,
    typingText,
    isAnyoneTyping: typingUsers.length > 0,
  };
}
