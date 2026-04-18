"use client";

import { useRealtime } from "@/lib/realtime/realtime-context";

export function usePresence() {
  const {
    isConnected,
    connectionError,
    onlineUsers,
    getOnlineUsers,
    isUserOnline,
    trackPresence,
    untrackPresence,
    updateStatus,
  } = useRealtime();

  return {
    isConnected,
    connectionError,
    onlineUsers,
    onlineCount: onlineUsers.size,
    getOnlineUsers,
    isUserOnline,
    trackPresence,
    untrackPresence,
    updateStatus,
  };
}
