"use client";

import { GatewayConnectionState, GatewayEventHandler, GatewayStateHandler } from "./types";
import { GatewayEvent, GatewayOps } from "./events";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;
if (!GATEWAY_URL) {
  throw new Error("GATEWAY_URL is not defined");
}
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Real WebSocket gateway implementation.
 */
export class WebSocketGateway {
  private ws: WebSocket | null = null;
  private _state: GatewayConnectionState = "disconnected";
  private token: string | null = null;

  private eventHandlers: Set<GatewayEventHandler> = new Set();
  private stateHandlers: Set<GatewayStateHandler> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private heartbeatIntervalMs: number | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  get state(): GatewayConnectionState {
    return this._state;
  }

  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.token = token;
    this.reconnectAttempts = 0;
    this.openConnection();
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // prevent auto-reconnect
    this.ws?.close(1000, "user disconnect");
    this.ws = null;
    this._state = "disconnected";
    this.token = null;
  }

  onEvent(handler: GatewayEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onStateChange(handler: GatewayStateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  sendTypingStart(channelId: string): void {
    this.sendRaw({
      op: "TYPING_START",
      d: { channel_id: channelId },
    });
  }

  requestGuildPresence(guildId: string): void {
    this.sendRaw({
      op: "REQUEST_GUILD_PRESENCE",
      d: { guild_id: guildId },
    });
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  private openConnection() {
    this.setState("connecting");
    const ws = new WebSocket(GATEWAY_URL!);
    this.ws = ws;

    ws.onopen = () => {
      console.log("[Gateway] WebSocket connected!");
      this.reconnectAttempts = 0;
      // We don't send IDENTIFY immediately. We wait for HELLO from server.
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as GatewayEvent;
        this.handleMessage(msg);
      } catch {
        console.error("[Gateway] Failed to parse message", ev.data);
      }
    };

    ws.onclose = (ev) => {
      console.log("[Gateway] WebSocket closed", ev.code, ev.reason);
      this.ws = null;
      this.stopHeartbeat();
      if (this._state !== "disconnected") {
        this.setState("reconnecting");
        this.scheduleReconnect();
      }
    };

    ws.onerror = (err) => {
      console.error("[Gateway] WebSocket error", err);
      ws.close();
    };
  }

  private handleMessage(msg: GatewayEvent) {
    console.log("[Gateway Event]", msg);
    switch (msg.op) {
      case GatewayOps.HELLO: {
        const data = msg.d as { heartbeat_interval: number };
        this.heartbeatIntervalMs = data.heartbeat_interval;
        this.startHeartbeat();

        // Always IDENTIFY
        this.sendRaw({
          op: "IDENTIFY",
          d: { token: this.token },
        });
        break;
      }

      case GatewayOps.DISPATCH: {
        // Fan-out to handlers
        this.eventHandlers.forEach((h) => {
          try {
            h(msg);
          } catch {
            /* ignore handler errors */
          }
        });

        // If it's a READY event (often sent as a dispatch), mark connected
        if (msg.t === ("READY" as any)) {
          this.setState("connected");
        }
        break;
      }

      case GatewayOps.HEARTBEAT_ACK:
        // Could track latency here
        break;

      case GatewayOps.INVALID_SESSION: {
        console.warn("[Gateway] Invalid session, clearing state and reconnecting");
        this.stopHeartbeat();
        // Must IDENTIFY again
        this.sendRaw({
          op: "IDENTIFY",
          d: { token: this.token },
        });
        break;
      }

      case GatewayOps.RECONNECT:
        this.ws?.close(); // Let the onclose handler reconnect us
        break;

      default:
        console.warn("[Gateway] Unhandled op", msg.op);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    if (!this.heartbeatIntervalMs) return;

    this.heartbeatTimer = setInterval(() => {
      this.sendRaw({ op: GatewayOps.HEARTBEAT, d: null });
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
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
      try {
        h(state);
      } catch {
        /* ignore */
      }
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
export const gateway = new WebSocketGateway();
