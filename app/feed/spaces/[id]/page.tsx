import { Suspense } from "react";
import { AudioSpaceRoom } from "@/components/stream/audio-space-room";
import { Loader2 } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return {
    title: `Audio Space | MasjidConnect`,
    description: "Join the live audio discussion",
  };
}

export default async function AudioSpaceRoomPage({ params }: PageProps) {
  const { id } = await params;
  
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Joining space...</p>
          </div>
        </div>
      }
    >
      <AudioSpaceRoom spaceId={id} />
    </Suspense>
  );
}
