import { createPluginRuntimeStore } from "openclaw/plugin-sdk/runtime-store";
import type { PluginRuntime } from "openclaw/plugin-sdk/core";

const { setRuntime: setNapCatRuntime, getRuntime: getNapCatRuntime } =
  createPluginRuntimeStore<PluginRuntime>("NapCat runtime not initialized");
export { getNapCatRuntime, setNapCatRuntime };
