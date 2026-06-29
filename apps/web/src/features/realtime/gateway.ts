"use client";

import {
  IGateway,
  GatewayConnectionState,
  GatewayEventHandler,
  GatewayStateHandler,
} from "./types";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "ws://localhost:8081/ws";
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Real WebSocket gateway implementation.
 *
 * Protocol:
 * 1. Connect to ws://gateway/ws
 * 2. Send IDENTIFY { token } — server validates JWT, responds with READY
 * 3. Send SUBSCRIBE_GUILD { guild_id } for each guild the user is in
 * 4. Receive events (VOICE_STATE_UPDATE, MESSAGE_CREATE, etc.)
 */
export class WebSocketGateway implements IGateway {
  private ws: WebSocket | null = null;
  private _state: GatewayConnectionState = "disconnected";
  private token: string | null = null;
  private guildIds: string[] = [];
  private eventHandlers: Set<GatewayEventHandler> = new Set();
  private stateHandlers: Set<GatewayStateHandler> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  get state(): GatewayConnectionState {
    return this._state;
  }

  connect(token: string, guildIds?: string[]): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.token = token;
    if (guildIds) this.guildIds = guildIds;
    this.reconnectAttempts = 0;
    this.openConnection();
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // prevent auto-reconnect
    this.ws?.close(1000, "user disconnect");
    this.ws = null;
    this.setState("disconnected");
  }

  onEvent(handler: GatewayEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onStateChange(handler: GatewayStateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  /** Subscribe to a specific guild's events. Can be called after connect. */
  subscribeGuild(guildId: string): void {
    if (!this.guildIds.includes(guildId)) {
      this.guildIds.push(guildId);
    }
    this.sendRaw({ type: "SUBSCRIBE_GUILD", data: { guild_id: guildId } });
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  private openConnection() {
    this.setState("connecting");
    const ws = new WebSocket(GATEWAY_URL);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      // Send IDENTIFY immediately
      this.sendRaw({ type: "IDENTIFY", data: { token: this.token } });
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        this.handleMessage(msg);
      } catch {
        console.error("[Gateway] Failed to parse message", ev.data);
      }
    };

    ws.onclose = () => {
      this.ws = null;
      if (this._state !== "disconnected") {
        this.setState("reconnecting");
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  private handleMessage(msg: { type: string; data?: unknown }) {
    switch (msg.type) {
      case "READY":
        this.setState("connected");
        // Subscribe to all guilds after READY
        this.guildIds.forEach((gid) => {
          this.sendRaw({ type: "SUBSCRIBE_GUILD", data: { guild_id: gid } });
        });
        break;

      case "PONG":
        break;

      default: {
        // Fan-out all other events to registered handlers
        const event = msg as any;
        this.eventHandlers.forEach((h) => {
          try { h(event); } catch { /* ignore handler errors */ }
        });
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.setState("disconnected");
      return;
    }
    const delay = RECONNECT_DELAY_MS * Math.min(this.reconnectAttempts + 1, 5);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      if (this.token) this.openConnection();
    }, delay);
  }

  private setState(state: GatewayConnectionState) {
    if (this._state === state) return;
    this._state = state;
    this.stateHandlers.forEach((h) => {
      try { h(state); } catch { /* ignore */ }
    });
  }

  private sendRaw(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}

/**
 * Singleton gateway instance.
 */
export const gateway: IGateway & { subscribeGuild?: (guildId: string) => void } =
  new WebSocketGateway();
