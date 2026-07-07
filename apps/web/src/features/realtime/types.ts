import { GatewayEvent } from "./events";

export type GatewayConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

// ─── Gateway Interface ───────────────────────────────────────────────────────
// The rest of the application programs against this interface.
// The concrete implementation (WebSocket, SSE, polling) is swappable.

export type GatewayEventHandler = (event: GatewayEvent) => void;
export type GatewayStateHandler = (state: GatewayConnectionState) => void;

export interface IGateway {
  /** Current connection state */
  readonly state: GatewayConnectionState;

  /** Connect to the gateway with an auth token */
  connect(token: string): void;

  /** Gracefully disconnect */
  disconnect(): void;

  /** Register a handler for gateway events */
  onEvent(handler: GatewayEventHandler): () => void;

  /** Register a handler for connection state changes */
  onStateChange(handler: GatewayStateHandler): () => void;
}
