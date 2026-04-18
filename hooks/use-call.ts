"use client";

import { useRealtime } from "@/lib/realtime/realtime-context";
import type { CallType } from "@/lib/realtime/types";

export function useCall() {
  const {
    currentCall,
    incomingCall,
    localStream,
    remoteStream,
    isMuted,
    isVideoEnabled,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  } = useRealtime();

  // Helper to start a call
  const startCall = async (
    receiverId: string,
    receiverName: string,
    receiverAvatar: string | null,
    callType: CallType
  ) => {
    try {
      await initiateCall(receiverId, receiverName, receiverAvatar, callType);
    } catch (error) {
      console.error("[useCall] Failed to start call:", error);
      throw error;
    }
  };

  // Check if we're in any call
  const isInCall = currentCall !== null;
  const hasIncomingCall = incomingCall !== null;

  // Get the other party in the call
  const otherParty = currentCall
    ? {
        id: currentCall.isIncoming ? currentCall.initiatorId : currentCall.receiverId,
        name: currentCall.isIncoming ? currentCall.initiatorName : currentCall.receiverName,
        avatar: currentCall.isIncoming ? currentCall.initiatorAvatar : currentCall.receiverAvatar,
      }
    : null;

  return {
    // Call state
    currentCall,
    incomingCall,
    isInCall,
    hasIncomingCall,
    otherParty,
    
    // Media streams
    localStream,
    remoteStream,
    
    // Media controls
    isMuted,
    isVideoEnabled,
    toggleMute,
    toggleVideo,
    
    // Call actions
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  };
}
