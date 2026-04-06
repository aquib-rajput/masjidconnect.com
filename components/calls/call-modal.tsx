"use client"

import { useEffect, useRef, useState } from "react"
import { useRealtime } from "@/lib/realtime/realtime-context"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Phone, 
  PhoneOff, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Users
} from "lucide-react"
import { cn } from "@/lib/utils"

export function CallModal() {
  const { 
    currentCall, 
    incomingCall, 
    callState,
    localStream,
    remoteStreams,
    answerCall, 
    endCall,
    toggleAudio,
    toggleVideo,
    isAudioEnabled,
    isVideoEnabled
  } = useRealtime()
  
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const callStartTimeRef = useRef<number | null>(null)
  
  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])
  
  // Track call duration
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (callState === 'connected') {
      if (!callStartTimeRef.current) {
        callStartTimeRef.current = Date.now()
      }
      interval = setInterval(() => {
        if (callStartTimeRef.current) {
          setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000))
        }
      }, 1000)
    } else {
      callStartTimeRef.current = null
      setCallDuration(0)
    }
    return () => clearInterval(interval)
  }, [callState])
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  const isOpen = !!currentCall || !!incomingCall
  const isIncoming = !!incomingCall && !currentCall
  const activeCall = currentCall || incomingCall
  const isVideoCall = activeCall?.type === 'video'
  const isGroupCall = activeCall?.type === 'group'
  
  if (!isOpen) return null
  
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className={cn(
          "p-0 gap-0 overflow-hidden border-none",
          isFullscreen ? "max-w-full h-full rounded-none" : "max-w-2xl",
          isVideoCall || isGroupCall ? "aspect-video" : "max-w-sm"
        )}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Incoming Call UI */}
        {isIncoming && (
          <div className="flex flex-col items-center justify-center p-8 gap-6 bg-gradient-to-b from-background to-muted min-h-[400px]">
            <div className="relative">
              <Avatar className="h-24 w-24 ring-4 ring-primary/20">
                <AvatarImage src={incomingCall.caller?.avatar_url || undefined} />
                <AvatarFallback className="text-2xl bg-primary/10">
                  {incomingCall.caller?.display_name?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                {isVideoCall ? 'Video Call' : isGroupCall ? 'Group Call' : 'Audio Call'}
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold">
                {incomingCall.caller?.display_name || 'Unknown Caller'}
              </h3>
              <p className="text-muted-foreground animate-pulse">
                Incoming {isVideoCall ? 'video' : isGroupCall ? 'group' : 'voice'} call...
              </p>
            </div>
            
            <div className="flex gap-6 mt-4">
              <Button
                variant="destructive"
                size="lg"
                className="rounded-full h-16 w-16"
                onClick={endCall}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
              <Button
                variant="default"
                size="lg"
                className="rounded-full h-16 w-16 bg-green-600 hover:bg-green-700"
                onClick={answerCall}
              >
                {isVideoCall ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        )}
        
        {/* Active Call UI */}
        {currentCall && (
          <div className="relative flex flex-col h-full min-h-[400px] bg-black">
            {/* Video/Audio Area */}
            {(isVideoCall || isGroupCall) ? (
              <div className="flex-1 relative bg-muted/20">
                {/* Remote Videos */}
                {remoteStreams.size > 0 ? (
                  <div className={cn(
                    "grid gap-2 h-full p-2",
                    remoteStreams.size === 1 ? "grid-cols-1" : 
                    remoteStreams.size <= 4 ? "grid-cols-2" : 
                    "grid-cols-3"
                  )}>
                    {Array.from(remoteStreams.entries()).map(([odId, stream]) => (
                      <RemoteVideo key={odId} stream={stream} muted={isSpeakerMuted} />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-white/60">
                      {callState === 'connecting' && (
                        <p className="animate-pulse">Connecting...</p>
                      )}
                      {callState === 'ringing' && (
                        <p className="animate-pulse">Ringing...</p>
                      )}
                      {callState === 'connected' && (
                        <p>Waiting for video...</p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Local Video (Picture-in-Picture) */}
                {localStream && isVideoEnabled && (
                  <div className="absolute bottom-20 right-4 w-32 aspect-video rounded-lg overflow-hidden shadow-lg border-2 border-white/20">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover mirror"
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Audio Call UI */
              <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-background to-muted">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={currentCall.participants?.[0]?.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl">
                    {currentCall.participants?.[0]?.display_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">
                    {currentCall.participants?.[0]?.display_name || 'Unknown'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {callState === 'connected' ? formatDuration(callDuration) : 
                     callState === 'connecting' ? 'Connecting...' :
                     callState === 'ringing' ? 'Ringing...' : callState}
                  </p>
                </div>
              </div>
            )}
            
            {/* Call Info Bar */}
            {callState === 'connected' && (isVideoCall || isGroupCall) && (
              <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-2 text-white text-sm flex items-center gap-2">
                  {isGroupCall && <Users className="h-4 w-4" />}
                  <span>{formatDuration(callDuration)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
            )}
            
            {/* Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex justify-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "rounded-full h-12 w-12",
                    !isAudioEnabled ? "bg-red-500/80 hover:bg-red-500" : "bg-white/20 hover:bg-white/30"
                  )}
                  onClick={toggleAudio}
                >
                  {isAudioEnabled ? (
                    <Mic className="h-5 w-5 text-white" />
                  ) : (
                    <MicOff className="h-5 w-5 text-white" />
                  )}
                </Button>
                
                {(isVideoCall || isGroupCall) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "rounded-full h-12 w-12",
                      !isVideoEnabled ? "bg-red-500/80 hover:bg-red-500" : "bg-white/20 hover:bg-white/30"
                    )}
                    onClick={toggleVideo}
                  >
                    {isVideoEnabled ? (
                      <Video className="h-5 w-5 text-white" />
                    ) : (
                      <VideoOff className="h-5 w-5 text-white" />
                    )}
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "rounded-full h-12 w-12",
                    isSpeakerMuted ? "bg-red-500/80 hover:bg-red-500" : "bg-white/20 hover:bg-white/30"
                  )}
                  onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
                >
                  {isSpeakerMuted ? (
                    <VolumeX className="h-5 w-5 text-white" />
                  ) : (
                    <Volume2 className="h-5 w-5 text-white" />
                  )}
                </Button>
                
                <Button
                  variant="destructive"
                  size="icon"
                  className="rounded-full h-12 w-12"
                  onClick={endCall}
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Remote Video Component
function RemoteVideo({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])
  
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className="w-full h-full object-cover rounded-lg bg-muted"
    />
  )
}
