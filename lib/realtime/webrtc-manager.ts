import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  DEFAULT_ICE_SERVERS,
  AUDIO_CONSTRAINTS,
  VIDEO_CONSTRAINTS,
  type CallType,
  type SignalingMessage,
  type CallState,
  type CallStatus,
} from './types';

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private signalingChannel: RealtimeChannel | null = null;
  private currentCallId: string | null = null;
  private isMuted: boolean = false;
  private isVideoEnabled: boolean = true;

  // Callbacks
  private onLocalStreamChange: ((stream: MediaStream | null) => void) | null = null;
  private onRemoteStreamChange: ((stream: MediaStream | null) => void) | null = null;
  private onCallStateChange: ((state: Partial<CallState>) => void) | null = null;
  private onSignalingMessage: ((message: SignalingMessage) => void) | null = null;

  constructor() {
    this.handleIceCandidate = this.handleIceCandidate.bind(this);
    this.handleTrack = this.handleTrack.bind(this);
    this.handleConnectionStateChange = this.handleConnectionStateChange.bind(this);
  }

  // Set callbacks
  setCallbacks(callbacks: {
    onLocalStreamChange?: (stream: MediaStream | null) => void;
    onRemoteStreamChange?: (stream: MediaStream | null) => void;
    onCallStateChange?: (state: Partial<CallState>) => void;
    onSignalingMessage?: (message: SignalingMessage) => void;
  }) {
    this.onLocalStreamChange = callbacks.onLocalStreamChange || null;
    this.onRemoteStreamChange = callbacks.onRemoteStreamChange || null;
    this.onCallStateChange = callbacks.onCallStateChange || null;
    this.onSignalingMessage = callbacks.onSignalingMessage || null;
  }

  // Set signaling channel
  setSignalingChannel(channel: RealtimeChannel) {
    this.signalingChannel = channel;
  }

  // Get local media stream
  async getLocalStream(callType: CallType): Promise<MediaStream> {
    try {
      const constraints = callType === 'video' ? VIDEO_CONSTRAINTS : AUDIO_CONSTRAINTS;
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.onLocalStreamChange?.(this.localStream);
      return this.localStream;
    } catch (error) {
      console.error('[WebRTC] Failed to get local stream:', error);
      throw new Error('Failed to access camera/microphone. Please check permissions.');
    }
  }

  // Create peer connection
  private createPeerConnection(): RTCPeerConnection {
    const config: RTCConfiguration = {
      iceServers: DEFAULT_ICE_SERVERS,
      iceCandidatePoolSize: 10,
    };

    this.peerConnection = new RTCPeerConnection(config);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });
    }

    // Set up event handlers
    this.peerConnection.onicecandidate = this.handleIceCandidate;
    this.peerConnection.ontrack = this.handleTrack;
    this.peerConnection.onconnectionstatechange = this.handleConnectionStateChange;

    return this.peerConnection;
  }

  // Handle ICE candidate
  private handleIceCandidate(event: RTCPeerConnectionIceEvent) {
    if (event.candidate && this.signalingChannel && this.currentCallId) {
      this.signalingChannel.send({
        type: 'broadcast',
        event: 'signaling',
        payload: {
          type: 'ice-candidate',
          callId: this.currentCallId,
          payload: event.candidate.toJSON(),
        },
      });
    }
  }

  // Handle remote track
  private handleTrack(event: RTCTrackEvent) {
    if (event.streams[0]) {
      this.remoteStream = event.streams[0];
      this.onRemoteStreamChange?.(this.remoteStream);
    }
  }

  // Handle connection state change
  private handleConnectionStateChange() {
    const state = this.peerConnection?.connectionState;
    
    let callStatus: CallStatus = 'connecting';
    switch (state) {
      case 'connected':
        callStatus = 'connected';
        break;
      case 'disconnected':
      case 'failed':
        callStatus = 'failed';
        break;
      case 'closed':
        callStatus = 'ended';
        break;
    }

    this.onCallStateChange?.({ status: callStatus });
  }

  // Initiate a call (caller side)
  async initiateCall(
    callId: string,
    receiverId: string,
    senderId: string,
    senderName: string,
    senderAvatar: string | null,
    callType: CallType
  ): Promise<RTCSessionDescriptionInit> {
    this.currentCallId = callId;
    
    // Get local stream
    await this.getLocalStream(callType);
    
    // Create peer connection
    this.createPeerConnection();

    // Create offer
    const offer = await this.peerConnection!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: callType === 'video',
    });
    
    await this.peerConnection!.setLocalDescription(offer);

    return offer;
  }

  // Accept a call (receiver side)
  async acceptCall(
    callId: string,
    offer: RTCSessionDescriptionInit,
    callType: CallType
  ): Promise<RTCSessionDescriptionInit> {
    this.currentCallId = callId;
    
    // Get local stream
    await this.getLocalStream(callType);
    
    // Create peer connection
    this.createPeerConnection();

    // Set remote description (offer)
    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
    
    // Create answer
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);

    return answer;
  }

  // Handle answer (caller side)
  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  // Add ICE candidate
  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (this.peerConnection) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('[WebRTC] Failed to add ICE candidate:', error);
      }
    }
  }

  // Toggle audio mute
  toggleMute(): boolean {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      this.isMuted = !audioTracks[0]?.enabled;
    }
    return this.isMuted;
  }

  // Toggle video
  toggleVideo(): boolean {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      this.isVideoEnabled = videoTracks[0]?.enabled ?? false;
    }
    return this.isVideoEnabled;
  }

  // Get current state
  getState() {
    return {
      localStream: this.localStream,
      remoteStream: this.remoteStream,
      isMuted: this.isMuted,
      isVideoEnabled: this.isVideoEnabled,
      callId: this.currentCallId,
      connectionState: this.peerConnection?.connectionState,
    };
  }

  // End call and cleanup
  endCall() {
    // Stop all local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
      this.onLocalStreamChange?.(null);
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Reset remote stream
    this.remoteStream = null;
    this.onRemoteStreamChange?.(null);

    // Reset state
    this.currentCallId = null;
    this.isMuted = false;
    this.isVideoEnabled = true;

    this.onCallStateChange?.({ status: 'ended' });
  }

  // Cleanup
  cleanup() {
    this.endCall();
    this.signalingChannel = null;
    this.onLocalStreamChange = null;
    this.onRemoteStreamChange = null;
    this.onCallStateChange = null;
    this.onSignalingMessage = null;
  }
}

// Singleton instance
let webrtcManager: WebRTCManager | null = null;

export function getWebRTCManager(): WebRTCManager {
  if (!webrtcManager) {
    webrtcManager = new WebRTCManager();
  }
  return webrtcManager;
}
