import { EventEmitter } from "node:events";

export type PriyaEvent = {
  type: string;
  payload: Record<string, unknown>;
  ts: number;
};

class EventBus extends EventEmitter {
  publish(type: string, payload: Record<string, unknown> = {}): void {
    const event: PriyaEvent = { type, payload, ts: Date.now() };
    this.emit("event", event);
    this.emit(type, event);
  }
}

export const eventBus = new EventBus();
eventBus.setMaxListeners(100);
