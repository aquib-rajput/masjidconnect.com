"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useStreamClient } from "@/lib/stream/stream-provider";

import "@stream-io/video-react-sdk/dist/css/styles.css";

interface VideoMeetingRoomProps {
  meetingId: string;
  isInstant?: boolean;
}

type LayoutType = "speaker" | "grid";

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
  
  const [layout, setLayout] = useState<LayoutType>("speaker");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

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
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLayout(layout === "speaker" ? "grid" : "speaker")}
                  className="text-zinc-400 hover:text-white hover:bg-zinc-700"
                >
                  <Grid className="h-5 w-5" />
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

      {/* Main Video Area */}
      <main className="flex-1 overflow-hidden p-2">
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
    </div>
  );
}
