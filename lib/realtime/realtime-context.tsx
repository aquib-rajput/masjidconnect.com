"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  type PresenceState,
  type TypingState,
  type CallState,
  type CallType,
  type SignalingMessage,
  type NotificationPayload,
  type RealtimeContextType,
} from "./types";
import { getWebRTCManager } from "./webrtc-manager";
import { toast } from "sonner";

// Create context with undefined default
const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

// Generate unique call ID
function generateCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

interface RealtimeProviderProps {
  children: ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const webrtcManager = getWebRTCManager();

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Presence state
  const [onlineUsers, setOnlineUsers] = useState<Map<string, PresenceState>>(new Map());

  // Typing state
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingState[]>>(new Map());

  // Call state
  const [currentCall, setCurrentCall] = useState<CallState | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallState | null>(null);

  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  // Notifications
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Channel refs
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const callChannelRef = useRef<RealtimeChannel | null>(null);
  const typingChannelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);

  // Set up WebRTC callbacks
  useEffect(() => {
    webrtcManager.setCallbacks({
      onLocalStreamChange: setLocalStream,
      onRemoteStreamChange: setRemoteStream,
      onCallStateChange: (state) => {
        setCurrentCall((prev) => prev ? { ...prev, ...state } : null);
      },
    });

    return () => {
      webrtcManager.cleanup();
    };
  }, [webrtcManager]);

  // Initialize presence channel
  useEffect(() => {
    if (!user || !profile) return;

    const channel = supabase.channel("online-users", {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users = new Map<string, PresenceState>();
        
        Object.entries(state).forEach(([key, presences]) => {
          if (presences && presences.length > 0) {
            const presence = presences[0] as PresenceState;
            users.set(key, presence);
          }
        });
        
        setOnlineUsers(users);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        if (newPresences && newPresences.length > 0) {
          const presence = newPresences[0] as PresenceState;
          setOnlineUsers((prev) => new Map(prev).set(key, presence));
        }
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setOnlineUsers((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          setConnectionError(null);
          
          // Track our presence
          await channel.track({
            id: user.id,
            full_name: profile.full_name || "Anonymous",
            avatar_url: profile.avatar_url,
            online_at: new Date().toISOString(),
            status: "online" as const,
          });
        } else if (status === "CHANNEL_ERROR") {
          setConnectionError("Failed to connect to presence channel");
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      channel.unsubscribe();
      presenceChannelRef.current = null;
    };
  }, [user, profile, supabase]);

  // Initialize call signaling channel
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`calls:${user.id}`);

    channel
      .on("broadcast", { event: "signaling" }, async ({ payload }) => {
        const message = payload as SignalingMessage;
        
        // Ignore messages not for us or from ourselves
        if (message.receiverId !== user.id || message.senderId === user.id) return;

        switch (message.type) {
          case "call-request":
            // Incoming call
            const newIncomingCall: CallState = {
              callId: message.callId,
              conversationId: "", // Will be set when needed
              type: message.callType,
              initiatorId: message.senderId,
              initiatorName: message.senderName,
              initiatorAvatar: message.senderAvatar,
              receiverId: user.id,
              receiverName: profile?.full_name || "You",
              receiverAvatar: profile?.avatar_url || null,
              status: "ringing",
              startedAt: null,
              isIncoming: true,
            };
            
            // Store the offer for later
            pendingOfferRef.current = message.payload as RTCSessionDescriptionInit;
            setIncomingCall(newIncomingCall);
            
            // Play ringtone or show notification
            toast.info(`${message.senderName} is calling...`, {
              duration: 30000,
              id: message.callId,
            });
            break;

          case "call-accepted":
            // Our call was accepted, handle the answer
            if (message.payload) {
              await webrtcManager.handleAnswer(message.payload as RTCSessionDescriptionInit);
              setCurrentCall((prev) => prev ? { ...prev, status: "connected", startedAt: new Date().toISOString() } : null);
            }
            break;

          case "call-rejected":
            // Call was rejected
            toast.dismiss(message.callId);
            toast.error("Call was declined");
            webrtcManager.endCall();
            setCurrentCall(null);
            break;

          case "call-ended":
            // Remote party ended the call
            toast.dismiss(message.callId);
            webrtcManager.endCall();
            setCurrentCall(null);
            setIncomingCall(null);
            break;

          case "call-busy":
            // Remote party is busy
            toast.dismiss(message.callId);
            toast.info("User is busy on another call");
            webrtcManager.endCall();
            setCurrentCall(null);
            break;

          case "ice-candidate":
            // Add ICE candidate
            if (message.payload) {
              await webrtcManager.addIceCandidate(message.payload as RTCIceCandidateInit);
            }
            break;

          case "offer":
            // Should be handled by call-request, but just in case
            break;

          case "answer":
            // Should be handled by call-accepted
            break;
        }
      })
      .subscribe();

    callChannelRef.current = channel;
    webrtcManager.setSignalingChannel(channel);

    return () => {
      channel.unsubscribe();
      callChannelRef.current = null;
    };
  }, [user, profile, supabase, webrtcManager]);

  // Track presence
  const trackPresence = useCallback(async () => {
    if (!user || !profile || !presenceChannelRef.current) return;
    
    await presenceChannelRef.current.track({
      id: user.id,
      full_name: profile.full_name || "Anonymous",
      avatar_url: profile.avatar_url,
      online_at: new Date().toISOString(),
      status: "online" as const,
    });
  }, [user, profile]);

  // Untrack presence
  const untrackPresence = useCallback(async () => {
    if (!presenceChannelRef.current) return;
    await presenceChannelRef.current.untrack();
  }, []);

  // Update status
  const updateStatus = useCallback(async (status: PresenceState["status"]) => {
    if (!user || !profile || !presenceChannelRef.current) return;
    
    await presenceChannelRef.current.track({
      id: user.id,
      full_name: profile.full_name || "Anonymous",
      avatar_url: profile.avatar_url,
      online_at: new Date().toISOString(),
      status,
    });
  }, [user, profile]);

  // Get online users
  const getOnlineUsers = useCallback(() => {
    return Array.from(onlineUsers.values());
  }, [onlineUsers]);

  // Check if user is online
  const isUserOnline = useCallback((userId: string) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  // Set typing indicator
  const setTyping = useCallback((conversationId: string, isTyping: boolean) => {
    if (!user || !profile) return;
    
    const channel = typingChannelsRef.current.get(conversationId);
    if (!channel) return;

    channel.track({
      user_id: user.id,
      user_name: profile.full_name || "Anonymous",
      conversation_id: conversationId,
      is_typing: isTyping,
      started_at: new Date().toISOString(),
    });
  }, [user, profile]);

  // Get typing users for a conversation
  const getTypingUsers = useCallback((conversationId: string) => {
    return typingUsers.get(conversationId) || [];
  }, [typingUsers]);

  // Subscribe to typing for a conversation
  const subscribeToTyping = useCallback((conversationId: string) => {
    if (!user) return () => {};

    // Check if already subscribed
    if (typingChannelsRef.current.has(conversationId)) {
      return () => {};
    }

    const channel = supabase.channel(`typing:${conversationId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const typing: TypingState[] = [];
        
        Object.entries(state).forEach(([key, presences]) => {
          if (key !== user.id && presences && presences.length > 0) {
            const presence = presences[0] as TypingState;
            if (presence.is_typing) {
              typing.push(presence);
            }
          }
        });
        
        setTypingUsers((prev) => new Map(prev).set(conversationId, typing));
      })
      .subscribe();

    typingChannelsRef.current.set(conversationId, channel);

    return () => {
      channel.unsubscribe();
      typingChannelsRef.current.delete(conversationId);
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(conversationId);
        return next;
      });
    };
  }, [user, supabase]);

  // Initiate a call
  const initiateCall = useCallback(async (
    receiverId: string,
    receiverName: string,
    receiverAvatar: string | null,
    callType: CallType
  ): Promise<string> => {
    if (!user || !profile || !callChannelRef.current) {
      throw new Error("Not authenticated");
    }

    // Check if already in a call
    if (currentCall) {
      throw new Error("Already in a call");
    }

    const callId = generateCallId();

    // Set up call state
    const newCall: CallState = {
      callId,
      conversationId: "",
      type: callType,
      initiatorId: user.id,
      initiatorName: profile.full_name || "Anonymous",
      initiatorAvatar: profile.avatar_url,
      receiverId,
      receiverName,
      receiverAvatar,
      status: "ringing",
      startedAt: null,
      isIncoming: false,
    };

    setCurrentCall(newCall);

    try {
      // Create offer
      const offer = await webrtcManager.initiateCall(
        callId,
        receiverId,
        user.id,
        profile.full_name || "Anonymous",
        profile.avatar_url,
        callType
      );

      // Send call request to receiver via their channel
      const receiverChannel = supabase.channel(`calls:${receiverId}`);
      
      await receiverChannel.subscribe();
      
      await receiverChannel.send({
        type: "broadcast",
        event: "signaling",
        payload: {
          type: "call-request",
          callId,
          senderId: user.id,
          senderName: profile.full_name || "Anonymous",
          senderAvatar: profile.avatar_url,
          receiverId,
          callType,
          payload: offer,
        } as SignalingMessage,
      });

      // Set timeout for unanswered call
      setTimeout(() => {
        setCurrentCall((prev) => {
          if (prev?.callId === callId && prev.status === "ringing") {
            webrtcManager.endCall();
            toast.error("No answer");
            return null;
          }
          return prev;
        });
      }, 30000);

      return callId;
    } catch (error) {
      setCurrentCall(null);
      throw error;
    }
  }, [user, profile, supabase, webrtcManager, currentCall]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!incomingCall || !user || !profile || !pendingOfferRef.current) return;

    toast.dismiss(incomingCall.callId);

    try {
      // Create answer
      const answer = await webrtcManager.acceptCall(
        incomingCall.callId,
        pendingOfferRef.current,
        incomingCall.type
      );

      // Send answer back to caller
      const callerChannel = supabase.channel(`calls:${incomingCall.initiatorId}`);
      await callerChannel.subscribe();
      
      await callerChannel.send({
        type: "broadcast",
        event: "signaling",
        payload: {
          type: "call-accepted",
          callId: incomingCall.callId,
          senderId: user.id,
          senderName: profile.full_name || "Anonymous",
          senderAvatar: profile.avatar_url,
          receiverId: incomingCall.initiatorId,
          callType: incomingCall.type,
          payload: answer,
        } as SignalingMessage,
      });

      // Move incoming call to current call
      setCurrentCall({
        ...incomingCall,
        status: "connected",
        startedAt: new Date().toISOString(),
      });
      setIncomingCall(null);
      pendingOfferRef.current = null;
    } catch (error) {
      console.error("[Realtime] Failed to accept call:", error);
      toast.error("Failed to accept call");
    }
  }, [incomingCall, user, profile, supabase, webrtcManager]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (!incomingCall || !user || !profile) return;

    toast.dismiss(incomingCall.callId);

    // Send rejection to caller
    const callerChannel = supabase.channel(`calls:${incomingCall.initiatorId}`);
    callerChannel.subscribe().then(() => {
      callerChannel.send({
        type: "broadcast",
        event: "signaling",
        payload: {
          type: "call-rejected",
          callId: incomingCall.callId,
          senderId: user.id,
          senderName: profile.full_name || "Anonymous",
          senderAvatar: profile.avatar_url,
          receiverId: incomingCall.initiatorId,
          callType: incomingCall.type,
        } as SignalingMessage,
      });
    });

    setIncomingCall(null);
    pendingOfferRef.current = null;
  }, [incomingCall, user, profile, supabase]);

  // End current call
  const endCall = useCallback(() => {
    if (!currentCall || !user || !profile) return;

    const otherPartyId = currentCall.isIncoming 
      ? currentCall.initiatorId 
      : currentCall.receiverId;

    // Send end signal to other party
    const otherChannel = supabase.channel(`calls:${otherPartyId}`);
    otherChannel.subscribe().then(() => {
      otherChannel.send({
        type: "broadcast",
        event: "signaling",
        payload: {
          type: "call-ended",
          callId: currentCall.callId,
          senderId: user.id,
          senderName: profile.full_name || "Anonymous",
          senderAvatar: profile.avatar_url,
          receiverId: otherPartyId,
          callType: currentCall.type,
        } as SignalingMessage,
      });
    });

    webrtcManager.endCall();
    setCurrentCall(null);
  }, [currentCall, user, profile, supabase, webrtcManager]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const muted = webrtcManager.toggleMute();
    setIsMuted(muted);
  }, [webrtcManager]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    const videoEnabled = webrtcManager.toggleVideo();
    setIsVideoEnabled(videoEnabled);
  }, [webrtcManager]);

  // Mark notification as read
  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => 
      prev.map((n) => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const value: RealtimeContextType = {
    // State
    isConnected,
    connectionError,
    onlineUsers,
    typingUsers,
    currentCall,
    incomingCall,
    notifications,
    unreadCount,
    localStream,
    remoteStream,
    isMuted,
    isVideoEnabled,

    // Actions
    trackPresence,
    untrackPresence,
    updateStatus,
    getOnlineUsers,
    isUserOnline,
    setTyping,
    getTypingUsers,
    subscribeToTyping,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    markNotificationRead,
    clearNotifications,
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error("useRealtime must be used within a RealtimeProvider");
  }
  return context;
}
