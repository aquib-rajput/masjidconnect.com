"use client";

import { useState } from "react";
import { Link2, Video, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface JoinMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin: (meetingId: string, passcode?: string) => void;
}

export function JoinMeetingDialog({
  open,
  onOpenChange,
  onJoin,
}: JoinMeetingDialogProps) {
  const [meetingLink, setMeetingLink] = useState("");
  const [passcode, setPasscode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const extractMeetingId = (input: string): string | null => {
    // Handle full URL
    if (input.includes("/feed/meetings/")) {
      const match = input.match(/\/feed\/meetings\/([a-zA-Z0-9-_]+)/);
      return match ? match[1] : null;
    }
    // Handle just the meeting ID
    if (input.match(/^[a-zA-Z0-9-_]+$/)) {
      return input;
    }
    return null;
  };

  const handleJoin = async () => {
    const meetingId = extractMeetingId(meetingLink.trim());
    
    if (!meetingId) {
      toast.error("Please enter a valid meeting link or ID");
      return;
    }

    setIsLoading(true);
    try {
      onJoin(meetingId, passcode || undefined);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error joining meeting:", error);
      toast.error("Failed to join meeting");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setMeetingLink("");
    setPasscode("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Join Meeting
          </DialogTitle>
          <DialogDescription>
            Enter a meeting link or ID to join
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="link">Meeting Link or ID *</Label>
            <Input
              id="link"
              placeholder="Paste meeting link or enter meeting ID"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="passcode" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Passcode (if required)
            </Label>
            <Input
              id="passcode"
              type="password"
              placeholder="Enter meeting passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleJoin}
            disabled={!meetingLink.trim() || isLoading}
            className="gap-2"
          >
            <Video className="h-4 w-4" />
            Join Meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
