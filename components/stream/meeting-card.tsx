"use client";

import { formatDistanceToNow, format } from "date-fns";
import {
  Video,
  Users,
  Clock,
  Calendar,
  Lock,
  Globe,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { VideoMeeting } from "@/lib/stream/types";

interface MeetingCardProps {
  meeting: VideoMeeting;
  onJoin: () => void;
  isHost?: boolean;
}

export function MeetingCard({ meeting, onJoin, isHost }: MeetingCardProps) {
  const isLive = meeting.status === "live";
  const isWaiting = meeting.status === "waiting";

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all hover:shadow-lg hover:border-primary/40",
        isLive && "border-primary/30 bg-gradient-to-br from-primary/5 to-transparent"
      )}
      onClick={onJoin}
    >
      <CardContent className="p-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isLive ? (
              <Badge variant="destructive" className="gap-1.5 animate-pulse">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                LIVE
              </Badge>
            ) : isWaiting ? (
              <Badge variant="secondary" className="gap-1.5">
                <Calendar className="h-3 w-3" />
                Scheduled
              </Badge>
            ) : (
              <Badge variant="outline">Ended</Badge>
            )}
            {meeting.is_private ? (
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" />
                Private
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Globe className="h-3 w-3" />
                Public
              </Badge>
            )}
          </div>
          {isHost && (
            <Badge variant="outline" className="text-primary border-primary/50">
              Host
            </Badge>
          )}
        </div>

        {/* Title & Description */}
        <h3 className="font-semibold text-base mb-1 line-clamp-2 group-hover:text-primary transition-colors">
          {meeting.title}
        </h3>
        {meeting.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {meeting.description}
          </p>
        )}

        {/* Host Info */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={meeting.host_avatar} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {meeting.host_name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{meeting.host_name}</p>
            {meeting.mosque_name && (
              <p className="text-xs text-muted-foreground truncate">
                {meeting.mosque_name}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {isLive ? (
              <>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {meeting.participant_count}
                  {meeting.max_participants && `/${meeting.max_participants}`}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDistanceToNow(new Date(meeting.started_at!), {
                    addSuffix: false,
                  })}
                </span>
              </>
            ) : isWaiting && meeting.scheduled_at ? (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(meeting.scheduled_at), "MMM d, h:mm a")}
              </span>
            ) : null}
          </div>
          <Button
            size="sm"
            variant={isLive ? "default" : "outline"}
            className="gap-1.5"
          >
            {isLive ? (
              <>
                <Video className="h-4 w-4" />
                Join
              </>
            ) : isWaiting ? (
              <>
                <PlayCircle className="h-4 w-4" />
                Start
              </>
            ) : (
              "View"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
