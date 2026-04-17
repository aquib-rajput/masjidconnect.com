"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Call,
  useCall,
  useCallStateHooks,
  CallingState,
  StreamCall,
  SpeakerLayout,
  CallControls,
  CallParticipantsList,
} from "@stream-io/video-react-sdk";
import {
  Mic,
  MicOff,
  Hand,
  LogOut,
  Users,
  Settings,
  MoreVertical,
  Radio,
  Volume2,
  VolumeX,
  Crown,
  MessageCircle,
  Share2,
  Copy,
  Check,
  Circle,
  Square,
  Languages,
  UserCircle,
  Download,
  Pause,
  Play,
  StopCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useStreamClient } from "@/lib/stream/stream-provider";

import "@stream-io/video-react-sdk/dist/css/styles.css";

// Caption languages supported
type CaptionLanguage = "en" | "ur" | "off";

const captionLanguages = {
  en: { name: "English", nativeName: "English" },
  ur: { name: "Urdu", nativeName: "اردو" },
  off: { name: "Off", nativeName: "Off" },
};

interface AudioSpaceRoomProps {
  spaceId: string;
}

export function AudioSpaceRoom({ spaceId }: AudioSpaceRoomProps) {
  const { user, profile } = useAuth();
  const { client, isLoading: clientLoading, error: clientError } = useStreamClient();
  const router = useRouter();
  const [call, setCall] = useState<Call | null>(null);
  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Join the call
  useEffect(() => {
    if (!client || !user) return;

    const joinCall = async () => {
      try {
        setIsJoining(true);
        setError(null);

        // Create or join the audio call
        const newCall = client.call("audio_room", spaceId);
        
        await newCall.join({
          create: true,
          data: {
            custom: {
              title: "Audio Space",
              host_id: user.id,
            },
          },
        });

        // Disable camera for audio-only space
        await newCall.camera.disable();

        setCall(newCall);
      } catch (err) {
        console.error("Error joining space:", err);
        setError(err instanceof Error ? err.message : "Failed to join space");
      } finally {
        setIsJoining(false);
      }
    };

    joinCall();

    return () => {
      if (call) {
        call.leave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, user, spaceId]);

  const handleLeave = async () => {
    if (call) {
      await call.leave();
    }
    router.push("/feed/spaces");
  };

  if (clientLoading || isJoining) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-primary/20 animate-pulse" />
            <Radio className="absolute inset-0 m-auto h-8 w-8 text-primary animate-bounce" />
          </div>
          <p className="text-muted-foreground">Joining audio space...</p>
        </div>
      </div>
    );
  }

  if (clientError || error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="rounded-full bg-destructive/10 p-4 w-fit mx-auto mb-4">
              <VolumeX className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Unable to Join Space</h2>
            <p className="text-muted-foreground mb-4">
              {clientError || error}
            </p>
            <Button onClick={() => router.push("/feed/spaces")}>
              Back to Spaces
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!call) {
    return null;
  }

  return (
    <StreamCall call={call}>
      <AudioSpaceUI onLeave={handleLeave} spaceId={spaceId} />
    </StreamCall>
  );
}

function AudioSpaceUI({
  onLeave,
  spaceId,
}: {
  onLeave: () => void;
  spaceId: string;
}) {
  const call = useCall();
  const { useCallCallingState, useParticipants, useLocalParticipant } =
    useCallStateHooks();
  const callingState = useCallCallingState();
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  
  // Audio controls
  const [isMuted, setIsMuted] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordOnlyMe, setRecordOnlyMe] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Captions state
  const [captionLanguage, setCaptionLanguage] = useState<CaptionLanguage>("off");
  const [currentCaption, setCurrentCaption] = useState("");
  const [showCaptionSettings, setShowCaptionSettings] = useState(false);
  
  // Speech recognition for captions
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Start muted
  useEffect(() => {
    if (call) {
      call.microphone.disable();
    }
  }, [call]);

  // Setup speech recognition for captions
  useEffect(() => {
    if (typeof window !== "undefined" && captionLanguage !== "off") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = captionLanguage === "ur" ? "ur-PK" : "en-US";
        
        recognition.onresult = (event) => {
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + " ";
            }
          }
          if (finalTranscript) {
            setCurrentCaption(finalTranscript);
            // Auto-clear caption after 5 seconds
            setTimeout(() => setCurrentCaption(""), 5000);
          }
        };
        
        recognition.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
        };
        
        recognitionRef.current = recognition;
        recognition.start();
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [captionLanguage]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      setRecordingTime(0);
    }
    
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      let stream: MediaStream;
      
      if (recordOnlyMe) {
        // Record only local audio
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        // Record all audio (using display media for system audio)
        // Note: This requires browser support and user permission
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: false,
          });
        } catch {
          // Fallback to local audio only
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          toast.info("Recording your audio only. System audio capture not available.");
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      
      recordedChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audio-space-${spaceId}-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Recording saved!");
        
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setShowRecordingDialog(false);
      toast.success("Recording started");
    } catch (err) {
      console.error("Error starting recording:", err);
      toast.error("Failed to start recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleMute = async () => {
    if (!call) return;
    if (isMuted) {
      await call.microphone.enable();
    } else {
      await call.microphone.disable();
    }
    setIsMuted(!isMuted);
  };

  const toggleHandRaise = () => {
    setHandRaised(!handRaised);
    toast(handRaised ? "Hand lowered" : "Hand raised - Host will see your request");
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}/feed/spaces/${spaceId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Separate speakers and listeners
  const speakers = participants.filter(
    (p) => !p.audioStream?.getAudioTracks()[0]?.muted || p.userId === localParticipant?.userId
  );
  const listeners = participants.filter(
    (p) => p.audioStream?.getAudioTracks()[0]?.muted && p.userId !== localParticipant?.userId
  );

  if (callingState === CallingState.LEFT) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Radio className="h-5 w-5 text-primary" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 border-2 border-background animate-pulse" />
            </div>
            <div>
              <h1 className="font-semibold">Audio Space</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="destructive" className="h-5 text-[10px] gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </Badge>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {participants.length}
                </span>
                {isRecording && (
                  <Badge variant="outline" className="h-5 text-[10px] gap-1 border-red-500 text-red-500">
                    <Circle className="h-1.5 w-1.5 fill-red-500 animate-pulse" />
                    REC {formatTime(recordingTime)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Caption Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={captionLanguage !== "off" ? "default" : "outline"}
                  size="icon"
                  className={cn(captionLanguage !== "off" && "bg-primary")}
                >
                  <Languages className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Captions Language</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={captionLanguage}
                  onValueChange={(value) => setCaptionLanguage(value as CaptionLanguage)}
                >
                  <DropdownMenuRadioItem value="off">Off</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="ur">اردو (Urdu)</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Recording Button */}
            {isRecording ? (
              <Button
                variant="destructive"
                size="icon"
                onClick={stopRecording}
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowRecordingDialog(true)}
              >
                <Circle className="h-4 w-4" />
              </Button>
            )}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyInviteLink}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Share2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share invite link</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Users className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>
                    Participants ({participants.length})
                  </SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        Speakers ({speakers.length})
                      </h3>
                      <div className="space-y-2">
                        {speakers.map((participant) => (
                          <ParticipantItem
                            key={participant.sessionId}
                            name={participant.name || "Anonymous"}
                            image={participant.image}
                            isSpeaker={true}
                            isMuted={participant.audioStream?.getAudioTracks()[0]?.muted}
                          />
                        ))}
                      </div>
                    </div>
                    {listeners.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">
                            Listeners ({listeners.length})
                          </h3>
                          <div className="space-y-2">
                            {listeners.map((participant) => (
                              <ParticipantItem
                                key={participant.sessionId}
                                name={participant.name || "Anonymous"}
                                image={participant.image}
                                isSpeaker={false}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={copyInviteLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy invite link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onLeave}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Leave space
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Captions Display */}
      {captionLanguage !== "off" && currentCaption && (
        <div className="px-4 py-2 bg-black/80 text-white">
          <p className={cn(
            "text-center text-lg",
            captionLanguage === "ur" && "font-urdu text-right direction-rtl"
          )}>
            {currentCaption}
          </p>
        </div>
      )}

      {/* Main Content - Speakers Grid */}
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Speakers Section */}
          <div className="mb-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Speakers
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {speakers.map((participant) => (
                <SpeakerAvatar
                  key={participant.sessionId}
                  name={participant.name || "Anonymous"}
                  image={participant.image}
                  isSpeaking={participant.isSpeaking}
                  isMuted={participant.audioStream?.getAudioTracks()[0]?.muted}
                  isLocal={participant.userId === localParticipant?.userId}
                />
              ))}
            </div>
          </div>

          {/* Listeners Section */}
          {listeners.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Listeners ({listeners.length})
              </h2>
              <div className="flex flex-wrap gap-3">
                {listeners.slice(0, 20).map((participant) => (
                  <Avatar
                    key={participant.sessionId}
                    className="h-10 w-10 border-2 border-background"
                  >
                    <AvatarImage src={participant.image} />
                    <AvatarFallback className="text-xs bg-muted">
                      {(participant.name || "A")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {listeners.length > 20 && (
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    +{listeners.length - 20}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Controls */}
      <footer className="border-t bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-4 px-4 py-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={handRaised ? "default" : "outline"}
                  size="lg"
                  className={cn(
                    "rounded-full h-14 w-14",
                    handRaised && "bg-amber-500 hover:bg-amber-600"
                  )}
                  onClick={toggleHandRaise}
                >
                  <Hand className={cn("h-6 w-6", handRaised && "animate-bounce")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {handRaised ? "Lower hand" : "Raise hand to speak"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isMuted ? "outline" : "default"}
                  size="lg"
                  className={cn(
                    "rounded-full h-16 w-16",
                    !isMuted && "bg-primary hover:bg-primary/90"
                  )}
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <MicOff className="h-7 w-7" />
                  ) : (
                    <Mic className="h-7 w-7" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isMuted ? "Unmute" : "Mute"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full h-14 w-14 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={onLeave}
                >
                  <LogOut className="h-6 w-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Leave space</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </footer>

      {/* Recording Dialog */}
      <Dialog open={showRecordingDialog} onOpenChange={setShowRecordingDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start Recording</DialogTitle>
            <DialogDescription>
              Choose your recording preferences
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-3">
                <UserCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="record-only-me" className="font-medium">
                    Record Only Me
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Only record your own voice
                  </p>
                </div>
              </div>
              <Switch
                id="record-only-me"
                checked={recordOnlyMe}
                onCheckedChange={setRecordOnlyMe}
              />
            </div>
            
            <Separator />
            
            <div className="text-sm text-muted-foreground">
              {recordOnlyMe ? (
                <p>Your voice will be recorded separately. Great for creating podcasts or personal notes.</p>
              ) : (
                <p>All audio in the space will be recorded (requires browser support).</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowRecordingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={startRecording} className="gap-2">
              <Circle className="h-4 w-4 fill-current" />
              Start Recording
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SpeakerAvatar({
  name,
  image,
  isSpeaking,
  isMuted,
  isLocal,
}: {
  name: string;
  image?: string;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isLocal?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <div
          className={cn(
            "rounded-full p-1 transition-all",
            isSpeaking && !isMuted && "ring-4 ring-primary ring-offset-2 ring-offset-background"
          )}
        >
          <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
            <AvatarImage src={image} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg">
              {name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        </div>
        {isMuted && (
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-destructive flex items-center justify-center">
            <MicOff className="h-3.5 w-3.5 text-white" />
          </div>
        )}
        {isLocal && (
          <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
            <span className="text-[10px] text-white font-bold">You</span>
          </div>
        )}
      </div>
      <span className="text-sm font-medium text-center truncate max-w-full px-1">
        {name}
      </span>
    </div>
  );
}

function ParticipantItem({
  name,
  image,
  isSpeaker,
  isMuted,
}: {
  name: string;
  image?: string;
  isSpeaker: boolean;
  isMuted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
      <Avatar className="h-10 w-10">
        <AvatarImage src={image} />
        <AvatarFallback className="bg-primary/10 text-primary text-sm">
          {name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground">
          {isSpeaker ? "Speaker" : "Listener"}
        </p>
      </div>
      {isSpeaker && (
        <div className="flex items-center gap-2">
          {isMuted ? (
            <MicOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Mic className="h-4 w-4 text-primary" />
          )}
        </div>
      )}
    </div>
  );
}

// Add global type for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
