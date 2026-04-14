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
  const [isMuted, setIsMuted] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [copied, setCopied] = useState(false);

  // Start muted
  useEffect(() => {
    if (call) {
      call.microphone.disable();
    }
  }, [call]);

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
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
