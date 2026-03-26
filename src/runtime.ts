import type { PluginRuntime } from "openclaw/plugin-sdk";

// Inline runtime store to avoid dependency on createPluginRuntimeStore
// which may not be exported in older OpenClaw versions.
let _runtime: PluginRuntime | null = null;

export function setNapCatRuntime(next: PluginRuntime): void {
  _runtime = next;
}

export function getNapCatRuntime(): PluginRuntime {
  if (!_runtime) {
    throw new Error("NapCat runtime not initialized");
  }
  return _runtime;
}
