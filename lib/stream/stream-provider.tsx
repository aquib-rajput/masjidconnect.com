"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  StreamVideo,
  StreamVideoClient,
  User as StreamUser,
} from "@stream-io/video-react-sdk";
import { useAuth } from "@/lib/auth-context";

interface StreamContextType {
  client: StreamVideoClient | null;
  isLoading: boolean;
  error: string | null;
}

const StreamContext = createContext<StreamContextType>({
  client: null,
  isLoading: true,
  error: null,
});

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;

// Token provider that fetches from our API
const tokenProvider = async (userId: string): Promise<string> => {
  const response = await fetch("/api/stream/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    throw new Error("Failed to get Stream token");
  }

  const { token } = await response.json();
  return token;
};

export function StreamProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !profile) {
      setClient(null);
      setIsLoading(false);
      return;
    }

    if (!apiKey) {
      setError("Stream API key is not configured");
      setIsLoading(false);
      return;
    }

    const initClient = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const streamUser: StreamUser = {
          id: user.id,
          name: profile.full_name || profile.username || "User",
          image: profile.avatar_url || undefined,
        };

        const newClient = new StreamVideoClient({
          apiKey,
          user: streamUser,
          tokenProvider: () => tokenProvider(user.id),
        });

        setClient(newClient);
      } catch (err) {
        console.error("Error initializing Stream client:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize Stream");
      } finally {
        setIsLoading(false);
      }
    };

    initClient();

    return () => {
      if (client) {
        client.disconnectUser();
        setClient(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.full_name, authLoading]);

  return (
    <StreamContext.Provider value={{ client, isLoading, error }}>
      {client ? (
        <StreamVideo client={client}>{children}</StreamVideo>
      ) : (
        children
      )}
    </StreamContext.Provider>
  );
}

export function useStreamClient() {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error("useStreamClient must be used within StreamProvider");
  }
  return context;
}
