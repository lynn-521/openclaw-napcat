import { createPluginRuntimeStore } from "openclaw/plugin-sdk/runtime-store";
import type { PluginRuntime } from "openclaw/plugin-sdk/core";

const { setRuntime: setNapCatRuntime, getRuntime: getNapCatRuntime } =
  createPluginRuntimeStore<PluginRuntime>("NapCat runtime not initialized");
export { getNapCatRuntime, setNapCatRuntime };

/** Per-message sender context for security checks (admin guard, rate limiter). */
interface SenderContext {
  senderId: number;
  groupId?: number;
}

/** Module-level sender context — set by monitor.ts during message processing. */
let _currentSenderContext: SenderContext | null = null;

/** Set the current sender context (called from monitor.ts). */
export function setCurrentSenderContext(senderId: number, groupId?: number): void {
  _currentSenderContext = { senderId, groupId };
}

/** Clear the sender context (called after message processing). */
export function clearCurrentSenderContext(): void {
  _currentSenderContext = null;
}

/** Get the current sender context (called from tool execute wrappers). */
export function getCurrentSenderContext(): SenderContext | null {
  return _currentSenderContext;
}
