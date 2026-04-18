// Realtime types for WebSocket and WebRTC functionality

// Presence state for tracking online users
export interface PresenceState {
  id: string;
  full_name: string;
  avatar_url: string | null;
  online_at: string;
  status: 'online' | 'away' | 'busy';
}

// Typing indicator state
export interface TypingState {
  user_id: string;
  user_name: string;
  conversation_id: string;
  is_typing: boolean;
  started_at: string;
}

// Call states
export type CallStatus = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'failed';
export type CallType = 'audio' | 'video';

// Call state
export interface CallState {
  callId: string;
  conversationId: string;
  type: CallType;
  initiatorId: string;
  initiatorName: string;
  initiatorAvatar: string | null;
  receiverId: string;
  receiverName: string;
  receiverAvatar: string | null;
  status: CallStatus;
  startedAt: string | null;
  isIncoming: boolean;
}

// WebRTC signaling messages
export type SignalingType = 'offer' | 'answer' | 'ice-candidate' | 'call-request' | 'call-accepted' | 'call-rejected' | 'call-ended' | 'call-busy';

export interface SignalingMessage {
  type: SignalingType;
  callId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  receiverId: string;
  callType: CallType;
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
}

// Notification types
export type NotificationType = 'message' | 'like' | 'comment' | 'event' | 'announcement' | 'call' | 'follow';

export interface NotificationPayload {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  created_at: string;
  read: boolean;
}

// Database change events
export interface DatabaseChangeEvent<T = unknown> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  old: T | null;
  new: T | null;
}

// Broadcast events
export interface BroadcastEvent {
  event: string;
  payload: Record<string, unknown>;
}

// Realtime channel types
export type ChannelType = 
  | 'presence' 
  | 'broadcast' 
  | 'postgres_changes';

// Realtime context state
export interface RealtimeState {
  // Connection status
  isConnected: boolean;
  connectionError: string | null;
  
  // Online presence
  onlineUsers: Map<string, PresenceState>;
  
  // Typing indicators (by conversation ID)
  typingUsers: Map<string, TypingState[]>;
  
  // Current call state
  currentCall: CallState | null;
  
  // Incoming call
  incomingCall: CallState | null;
  
  // Notifications
  notifications: NotificationPayload[];
  unreadCount: number;
}

// Realtime context actions
export interface RealtimeActions {
  // Presence
  trackPresence: () => Promise<void>;
  untrackPresence: () => Promise<void>;
  updateStatus: (status: PresenceState['status']) => Promise<void>;
  getOnlineUsers: () => PresenceState[];
  isUserOnline: (userId: string) => boolean;
  
  // Typing
  setTyping: (conversationId: string, isTyping: boolean) => void;
  getTypingUsers: (conversationId: string) => TypingState[];
  subscribeToTyping: (conversationId: string) => () => void;
  
  // Calls
  initiateCall: (receiverId: string, receiverName: string, receiverAvatar: string | null, callType: CallType) => Promise<string>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  
  // Media
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  
  // Notifications
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
}

// Combined realtime context type
export type RealtimeContextType = RealtimeState & RealtimeActions;

// ICE Server configuration
export interface ICEServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// WebRTC configuration
export const DEFAULT_ICE_SERVERS: ICEServerConfig[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

// Media constraints
export const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
};

export const VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: 'user',
  },
};
