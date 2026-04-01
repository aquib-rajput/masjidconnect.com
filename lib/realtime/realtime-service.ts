"use client";

import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

type StatusListener = (status: ConnectionStatus) => void;
type TableChangeHandler<T = any> = (
  payload: RealtimePostgresChangesPayload<T>
) => void;

interface ChannelSubscription {
  channel: RealtimeChannel;
  refCount: number;
}

class RealtimeService {
  private static instance: RealtimeService | null = null;
  private supabase = createClient();
  private channels: Map<string, ChannelSubscription> = new Map();
  private statusListeners: Set<StatusListener> = new Set();
  private _status: ConnectionStatus = "disconnected";
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  private setStatus(status: ConnectionStatus) {
    this._status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  subscribeToStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    // Immediately notify of current status
    listener(this._status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Subscribe to postgres changes on a table
   * Returns an unsubscribe function
   */
  subscribeToTable<T = any>(
    channelName: string,
    table: string,
    filter: string | null,
    onInsert?: TableChangeHandler<T>,
    onUpdate?: TableChangeHandler<T>,
    onDelete?: TableChangeHandler<T>
  ): () => void {
    const existingSub = this.channels.get(channelName);

    if (existingSub) {
      existingSub.refCount++;
      return () => this.unsubscribeChannel(channelName);
    }

    this.setStatus("connecting");

    const channel = this.supabase.channel(channelName);

    // Build the subscription config
    const config: any = {
      event: "*",
      schema: "public",
      table,
    };

    if (filter) {
      config.filter = filter;
    }

    channel.on("postgres_changes", config, (payload: RealtimePostgresChangesPayload<T>) => {
      switch (payload.eventType) {
        case "INSERT":
          onInsert?.(payload);
          break;
        case "UPDATE":
          onUpdate?.(payload);
          break;
        case "DELETE":
          onDelete?.(payload);
          break;
      }
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        this.setStatus("connected");
        this.reconnectAttempts = 0;
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        this.handleDisconnect(channelName);
      } else if (status === "TIMED_OUT") {
        this.handleTimeout(channelName);
      }
    });

    this.channels.set(channelName, { channel, refCount: 1 });

    return () => this.unsubscribeChannel(channelName);
  }

  /**
   * Subscribe to multiple events on a single channel
   */
  subscribeToMultipleTables(
    channelName: string,
    subscriptions: Array<{
      table: string;
      filter?: string;
      onInsert?: TableChangeHandler;
      onUpdate?: TableChangeHandler;
      onDelete?: TableChangeHandler;
    }>
  ): () => void {
    const existingSub = this.channels.get(channelName);

    if (existingSub) {
      existingSub.refCount++;
      return () => this.unsubscribeChannel(channelName);
    }

    this.setStatus("connecting");

    let channel = this.supabase.channel(channelName);

    for (const sub of subscriptions) {
      const config: any = {
        event: "*",
        schema: "public",
        table: sub.table,
      };

      if (sub.filter) {
        config.filter = sub.filter;
      }

      channel = channel.on("postgres_changes", config, (payload: RealtimePostgresChangesPayload<any>) => {
        switch (payload.eventType) {
          case "INSERT":
            sub.onInsert?.(payload);
            break;
          case "UPDATE":
            sub.onUpdate?.(payload);
            break;
          case "DELETE":
            sub.onDelete?.(payload);
            break;
        }
      });
    }

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        this.setStatus("connected");
        this.reconnectAttempts = 0;
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        this.handleDisconnect(channelName);
      } else if (status === "TIMED_OUT") {
        this.handleTimeout(channelName);
      }
    });

    this.channels.set(channelName, { channel, refCount: 1 });

    return () => this.unsubscribeChannel(channelName);
  }

  private unsubscribeChannel(channelName: string) {
    const sub = this.channels.get(channelName);
    if (!sub) return;

    sub.refCount--;
    if (sub.refCount <= 0) {
      this.supabase.removeChannel(sub.channel);
      this.channels.delete(channelName);

      // If no more channels, set status to disconnected
      if (this.channels.size === 0) {
        this.setStatus("disconnected");
      }
    }
  }

  private handleDisconnect(channelName: string) {
    console.warn(`[Realtime] Channel ${channelName} disconnected`);
    this.setStatus("disconnected");
    this.attemptReconnect(channelName);
  }

  private handleTimeout(channelName: string) {
    console.warn(`[Realtime] Channel ${channelName} timed out`);
    this.setStatus("reconnecting");
    this.attemptReconnect(channelName);
  }

  private attemptReconnect(channelName: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[Realtime] Max reconnect attempts reached");
      this.setStatus("disconnected");
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.setStatus("reconnecting");
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);

    this.reconnectTimeout = setTimeout(() => {
      const sub = this.channels.get(channelName);
      if (sub) {
        sub.channel.subscribe();
      }
    }, delay);
  }

  /**
   * Force reconnect all channels
   */
  reconnectAll() {
    this.setStatus("reconnecting");
    this.channels.forEach((sub, name) => {
      this.supabase.removeChannel(sub.channel);
      this.channels.delete(name);
    });
    // Channels will be re-created by components on next render
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.channels.forEach((sub) => {
      this.supabase.removeChannel(sub.channel);
    });
    this.channels.clear();
    this.statusListeners.clear();
    this.setStatus("disconnected");
  }
}

// Export singleton instance getter
export const getRealtimeService = () => RealtimeService.getInstance();
