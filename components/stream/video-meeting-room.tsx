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
  PaginatedGridLayout,
  CallParticipantsList,
  CallStatsButton,
} from "@stream-io/video-react-sdk";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Users,
  Settings,
  MoreVertical,
  MessageCircle,
  Hand,
  Grid,
  Maximize,
  Minimize,
  Copy,
  Check,
  ChevronUp,
  Circle,
  StopCircle,
  Languages,
  UserCircle,
  Download,
  Layout,
  Monitor,
  Captions,
  CaptionsOff,
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

interface VideoMeetingRoomProps {
  meetingId: string;
  isInstant?: boolean;
}

type LayoutType = "speaker" | "grid";
type RecordingMode = "all" | "only-me" | "screen-only";

export function VideoMeetingRoom({ meetingId, isInstant }: VideoMeetingRoomProps) {
  const { user, profile } = useAuth();
  const { client, isLoading: clientLoading, error: clientError } = useStreamClient();
  const router = useRouter();
  const [call, setCall] = useState<Call | null>(null);
  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  // Join the call
  useEffect(() => {
    if (!client || !user) return;

    const joinCall = async () => {
      try {
        setIsJoining(true);
        setError(null);

        const newCall = client.call("default", meetingId);

        await newCall.join({
          create: true,
          data: {
            custom: {
              title: isInstant ? "Instant Meeting" : "Scheduled Meeting",
              host_id: user.id,
            },
          },
        });

        setCall(newCall);
        setIsSetupComplete(true);
      } catch (err) {
        console.error("Error joining meeting:", err);
        setError(err instanceof Error ? err.message : "Failed to join meeting");
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
  }, [client, user, meetingId]);

  const handleLeave = async () => {
    if (call) {
      await call.leave();
    }
    router.push("/feed/meetings");
  };

  if (clientLoading || isJoining) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-900">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-primary/20 animate-pulse" />
            <Video className="absolute inset-0 m-auto h-8 w-8 text-primary animate-bounce" />
          </div>
          <p className="text-zinc-400">Connecting to meeting...</p>
        </div>
      </div>
    );
  }

  if (clientError || error) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-900">
        <Card className="max-w-md bg-zinc-800 border-zinc-700">
          <CardContent className="pt-6 text-center">
            <div className="rounded-full bg-destructive/10 p-4 w-fit mx-auto mb-4">
              <VideoOff className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">
              Unable to Join Meeting
            </h2>
            <p className="text-zinc-400 mb-4">{clientError || error}</p>
            <Button onClick={() => router.push("/feed/meetings")}>
              Back to Meetings
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
      <MeetingUI onLeave={handleLeave} meetingId={meetingId} />
    </StreamCall>
  );
}

function MeetingUI({
  onLeave,
  meetingId,
}: {
  onLeave: () => void;
  meetingId: string;
}) {
  const call = useCall();
  const {
    useCallCallingState,
    useParticipants,
    useLocalParticipant,
    useCameraState,
    useMicrophoneState,
    useScreenShareState,
  } = useCallStateHooks();
  
  const callingState = useCallCallingState();
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const { camera, isMute: isCameraMuted } = useCameraState();
  const { microphone, isMute: isMicMuted } = useMicrophoneState();
  const { screenShare, isMute: isScreenShareOff } = useScreenShareState();
  
  // UI state
  const [layout, setLayout] = useState<LayoutType>("speaker");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("all");
  const [recordingTime, setRecordingTime] = useState(0);
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Captions state
  const [captionLanguage, setCaptionLanguage] = useState<CaptionLanguage>("off");
  const [currentCaption, setCurrentCaption] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      let stream: MediaStream;
      
      if (recordingMode === "only-me") {
        // Record only local video and audio
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
      } else if (recordingMode === "screen-only") {
        // Record screen with audio
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { 
            displaySurface: "monitor",
          },
          audio: true,
        });
      } else {
        // Record everything (screen + system audio)
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
        } catch {
          // Fallback to local camera/mic
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
          });
          toast.info("Recording your camera. System audio capture not available.");
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
      });
      
      recordedChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `meeting-${meetingId}-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Recording saved!");
        
        stream.getTracks().forEach((track) => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
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

  const toggleCamera = async () => {
    if (isCameraMuted) {
      await camera.enable();
    } else {
      await camera.disable();
    }
  };

  const toggleMic = async () => {
    if (isMicMuted) {
      await microphone.enable();
    } else {
      await microphone.disable();
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenShareOff) {
      await screenShare.enable();
    } else {
      await screenShare.disable();
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const copyMeetingLink = () => {
    const url = `${window.location.origin}/feed/meetings/${meetingId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Meeting link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (callingState === CallingState.LEFT) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-900">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-zinc-800/80 backdrop-blur-sm border-b border-zinc-700">
        <div className="flex items-center gap-3">
          <Badge variant="destructive" className="gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            LIVE
          </Badge>
          <span className="text-sm text-zinc-400">
            {participants.length} participant{participants.length !== 1 ? "s" : ""}
          </span>
          {isRecording && (
            <Badge variant="outline" className="gap-1.5 border-red-500 text-red-500">
              <Circle className="h-2 w-2 fill-red-500 animate-pulse" />
              REC {formatTime(recordingTime)}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Caption Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "text-zinc-400 hover:text-white hover:bg-zinc-700",
                  captionLanguage !== "off" && "text-primary bg-primary/20"
                )}
              >
                {captionLanguage !== "off" ? (
                  <Captions className="h-5 w-5" />
                ) : (
                  <CaptionsOff className="h-5 w-5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-800 border-zinc-700">
              <DropdownMenuLabel className="text-zinc-400">Captions</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-700" />
              <DropdownMenuRadioGroup
                value={captionLanguage}
                onValueChange={(value) => setCaptionLanguage(value as CaptionLanguage)}
              >
                <DropdownMenuRadioItem value="off" className="text-zinc-200">Off</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="en" className="text-zinc-200">English</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="ur" className="text-zinc-200">اردو (Urdu)</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Recording Button */}
          {isRecording ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={stopRecording}
              className="text-red-500 hover:text-red-400 hover:bg-red-500/20"
            >
              <StopCircle className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowRecordingDialog(true)}
              className="text-zinc-400 hover:text-white hover:bg-zinc-700"
            >
              <Circle className="h-5 w-5" />
            </Button>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLayout(layout === "speaker" ? "grid" : "speaker")}
                  className="text-zinc-400 hover:text-white hover:bg-zinc-700"
                >
                  {layout === "speaker" ? (
                    <Grid className="h-5 w-5" />
                  ) : (
                    <Layout className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {layout === "speaker" ? "Grid view" : "Speaker view"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="text-zinc-400 hover:text-white hover:bg-zinc-700"
                >
                  {isFullscreen ? (
                    <Minimize className="h-5 w-5" />
                  ) : (
                    <Maximize className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyMeetingLink}
                  className="text-zinc-400 hover:text-white hover:bg-zinc-700"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy invite link</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Sheet open={showParticipants} onOpenChange={setShowParticipants}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-zinc-400 hover:text-white hover:bg-zinc-700"
              >
                <Users className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="bg-zinc-800 border-zinc-700">
              <SheetHeader>
                <SheetTitle className="text-white">
                  Participants ({participants.length})
                </SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.sessionId}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-700/50"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={participant.image} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {(participant.name || "A")
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {participant.name || "Anonymous"}
                          {participant.userId === localParticipant?.userId && (
                            <span className="text-zinc-400 ml-1">(You)</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {participant.audioStream?.getAudioTracks()[0]?.muted !== false && (
                          <MicOff className="h-4 w-4 text-zinc-500" />
                        )}
                        {participant.videoStream?.getVideoTracks()[0]?.muted !== false && (
                          <VideoOff className="h-4 w-4 text-zinc-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Captions Display */}
      {captionLanguage !== "off" && currentCaption && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10 px-6 py-3 bg-black/90 rounded-lg max-w-2xl">
          <p className={cn(
            "text-white text-lg text-center",
            captionLanguage === "ur" && "font-urdu direction-rtl"
          )}>
            {currentCaption}
          </p>
        </div>
      )}

      {/* Main Video Area */}
      <main className="flex-1 overflow-hidden p-2 relative">
        <div className="h-full rounded-xl overflow-hidden bg-zinc-800">
          {layout === "speaker" ? (
            <SpeakerLayout participantsBarPosition="bottom" />
          ) : (
            <PaginatedGridLayout />
          )}
        </div>
      </main>

      {/* Bottom Controls */}
      <footer className="px-4 py-4 bg-zinc-800/80 backdrop-blur-sm border-t border-zinc-700">
        <div className="flex items-center justify-center gap-3">
          {/* Mic Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isMicMuted ? "destructive" : "secondary"}
                  size="lg"
                  className={cn(
                    "rounded-full h-14 w-14",
                    !isMicMuted && "bg-zinc-700 hover:bg-zinc-600"
                  )}
                  onClick={toggleMic}
                >
                  {isMicMuted ? (
                    <MicOff className="h-6 w-6" />
                  ) : (
                    <Mic className="h-6 w-6" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isMicMuted ? "Unmute" : "Mute"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Camera Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isCameraMuted ? "destructive" : "secondary"}
                  size="lg"
                  className={cn(
                    "rounded-full h-14 w-14",
                    !isCameraMuted && "bg-zinc-700 hover:bg-zinc-600"
                  )}
                  onClick={toggleCamera}
                >
                  {isCameraMuted ? (
                    <VideoOff className="h-6 w-6" />
                  ) : (
                    <Video className="h-6 w-6" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isCameraMuted ? "Turn on camera" : "Turn off camera"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Screen Share Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={!isScreenShareOff ? "default" : "secondary"}
                  size="lg"
                  className={cn(
                    "rounded-full h-14 w-14",
                    isScreenShareOff && "bg-zinc-700 hover:bg-zinc-600"
                  )}
                  onClick={toggleScreenShare}
                >
                  {!isScreenShareOff ? (
                    <ScreenShareOff className="h-6 w-6" />
                  ) : (
                    <ScreenShare className="h-6 w-6" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {!isScreenShareOff ? "Stop sharing" : "Share screen"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* More Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="lg"
                className="rounded-full h-14 w-14 bg-zinc-700 hover:bg-zinc-600"
              >
                <ChevronUp className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              side="top"
              className="bg-zinc-800 border-zinc-700"
            >
              <DropdownMenuItem
                onClick={() => setShowRecordingDialog(true)}
                className="text-zinc-200 focus:bg-zinc-700 focus:text-white"
              >
                <Circle className="mr-2 h-4 w-4" />
                {isRecording ? "Recording settings" : "Start recording"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={copyMeetingLink}
                className="text-zinc-200 focus:bg-zinc-700 focus:text-white"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy invite link
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowParticipants(true)}
                className="text-zinc-200 focus:bg-zinc-700 focus:text-white"
              >
                <Users className="mr-2 h-4 w-4" />
                View participants
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-700" />
              <DropdownMenuItem
                onClick={() => setLayout(layout === "speaker" ? "grid" : "speaker")}
                className="text-zinc-200 focus:bg-zinc-700 focus:text-white"
              >
                <Grid className="mr-2 h-4 w-4" />
                {layout === "speaker" ? "Grid view" : "Speaker view"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Leave Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="lg"
                  className="rounded-full h-14 w-14 bg-red-600 hover:bg-red-700"
                  onClick={onLeave}
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Leave meeting</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </footer>

      {/* Recording Dialog */}
      <Dialog open={showRecordingDialog} onOpenChange={setShowRecordingDialog}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-700 text-white">
          <DialogHeader>
            <DialogTitle>Recording Settings</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Choose what to record
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all",
                recordingMode === "all"
                  ? "border-primary bg-primary/10"
                  : "border-zinc-700 hover:border-zinc-600"
              )}
              onClick={() => setRecordingMode("all")}
            >
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center",
                recordingMode === "all" ? "bg-primary" : "bg-zinc-800"
              )}>
                <Users className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Record Everyone</p>
                <p className="text-sm text-zinc-400">Capture the entire meeting</p>
              </div>
            </div>
            
            <div
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all",
                recordingMode === "only-me"
                  ? "border-primary bg-primary/10"
                  : "border-zinc-700 hover:border-zinc-600"
              )}
              onClick={() => setRecordingMode("only-me")}
            >
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center",
                recordingMode === "only-me" ? "bg-primary" : "bg-zinc-800"
              )}>
                <UserCircle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Record Only Me</p>
                <p className="text-sm text-zinc-400">Only your camera and audio</p>
              </div>
            </div>
            
            <div
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all",
                recordingMode === "screen-only"
                  ? "border-primary bg-primary/10"
                  : "border-zinc-700 hover:border-zinc-600"
              )}
              onClick={() => setRecordingMode("screen-only")}
            >
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center",
                recordingMode === "screen-only" ? "bg-primary" : "bg-zinc-800"
              )}>
                <Monitor className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Screen Only</p>
                <p className="text-sm text-zinc-400">Record screen with audio</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowRecordingDialog(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </Button>
            {isRecording ? (
              <Button onClick={stopRecording} variant="destructive" className="gap-2">
                <StopCircle className="h-4 w-4" />
                Stop Recording
              </Button>
            ) : (
              <Button onClick={startRecording} className="gap-2">
                <Circle className="h-4 w-4 fill-current" />
                Start Recording
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
