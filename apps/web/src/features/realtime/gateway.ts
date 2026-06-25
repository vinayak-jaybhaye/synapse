import { IGateway, GatewayConnectionState, GatewayEventHandler, GatewayStateHandler } from "./types";

/**
 * No-op gateway implementation.
 *
 * Used as the default before WebSocket integration is built.
 * The application works normally with REST-only — this gateway
 * is a placeholder that satisfies the IGateway interface.
 *
 * When ready to implement WebSocket:
 * 1. Create WebSocketGateway implementing IGateway
 * 2. Swap the export in this file (or use a factory)
 * 3. Wire it into useGateway.ts hook
 */
export class NoopGateway implements IGateway {
  readonly state: GatewayConnectionState = "disconnected";

  connect(_token: string): void {
    // Will be replaced with WebSocket connection logic
    console.debug("[Gateway] NoopGateway.connect() called — no-op");
  }

  disconnect(): void {
    console.debug("[Gateway] NoopGateway.disconnect() called — no-op");
  }

  onEvent(_handler: GatewayEventHandler): () => void {
    // Returns unsubscribe function
    return () => {};
  }

  onStateChange(_handler: GatewayStateHandler): () => void {
    return () => {};
  }
}

/**
 * Singleton gateway instance.
 * Replace with WebSocketGateway when ready.
 */
export const gateway: IGateway = new NoopGateway();
