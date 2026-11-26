import "server-only";
import { createDemo, type Demo } from "./scenario";
import { createDemoApi } from "./api";

// The single-operator demo shares one process-local scenario across route bundles
// and development reloads. It is not a session store for a deployed application.
const processState = globalThis as typeof globalThis & {
  kyaOsDemo?: { demo?: Promise<Demo>; api: ReturnType<typeof createDemoApi> };
};

export function getDemo() {
  const state = processState.kyaOsDemo!;
  return (state.demo ??= createDemo());
}

processState.kyaOsDemo ??= { api: createDemoApi(getDemo) };
export const demoApi = processState.kyaOsDemo.api;
