// This file contains utility functions for managing timers and timeouts for session management.
// Unfortunately, the delay param in Node Timeouts is a 32-bit signed integer, meaning it can only represent delays up to ~24.8 days.
// This file provides functions to handle long delays by breaking them into smaller chunks.
// These functions are separate from the normal utils function to reduce clutter and improve visibility.
// Use `setTimeoutInMap` for short, frequent nudges (10s), and `setCappedTimeoutInMap` for anything that could exceed ~24.8 days.

// Always store controllers (uniform shape)
export type TimerController = { clear: () => void };
export type TimerMap = Record<string, TimerController>;

export const MAX_DELAY_MS = 2_147_483_647; // ~24.8 days

/** @internal */
function toIntMs(x: number) {
  return Math.max(0, Math.floor(Number.isFinite(x) ? x : 0));
}

/**
 * @internal A drop-in replacement for `setTimeout` that supports arbitrarily long delays.
 *
 * ### Why?
 * Browsers clamp `setTimeout` delays to a 32-bit signed integer,
 * i.e. a maximum of ~24.8 days (`2_147_483_647ms`). Any larger value
 * will fire almost immediately. This helper safely schedules timeouts
 * that can be months or years into the future.
 *
 * ### How it works
 * - On call, we record a fixed **target timestamp** (`now + delayMs`).
 * - We schedule a single "leg" of at most ~24.8 days into the future,
 *   with an internal `tick` function as the callback.
 * - When a leg expires, `tick` checks how much time is left:
 *   - If `remaining > 0`, it schedules the next leg (`min(MAX_DELAY_MS, remaining)`).
 *   - If `remaining <= 0`, the full delay has passed and we finally call your `cb()`.
 * - At any time, only **one** leg is active. Calling `.clear()` cancels
 *   the current leg and prevents further hops.
 *
 * ### Benefits
 * - Works seamlessly for both short and very long delays.
 * - Survives tab sleep / system suspend: when the tab wakes,
 *   `tick` re-checks the target timestamp and fires immediately if overdue.
 * - No drift accumulation: each hop recalculates based on the fixed target,
 *   so you always land as close as possible to the intended deadline.
 *
 * ### Example
 * ```ts
 * const controller = setCappedTimeout(() => {
 *   console.log("A whole year later!");
 * }, 1000 * 60 * 60 * 24 * 365);
 *
 * // Cancel if needed
 * controller.clear();
 * ```
 *
 * @param cb - Function to run once the full delay has elapsed.
 * @param delayMs - Delay in milliseconds (can exceed 2_147_483_647).
 * @returns A controller with a `.clear()` method to cancel the timeout.
 */
export function setCappedTimeout(
  cb: () => void,
  delayMs: number,
): TimerController {
  const target = Date.now() + toIntMs(delayMs);
  let handle: number | undefined;

  const tick = () => {
    const remaining = target - Date.now();
    if (remaining <= 0) {
      cb();
      return;
    }
    handle = window.setTimeout(tick, Math.min(MAX_DELAY_MS, remaining));
  };

  tick();

  return {
    clear() {
      if (handle !== undefined) {
        window.clearTimeout(handle);
        handle = undefined;
      }
    },
  };
}

/** @internal Simple one-shot timeout that still returns a controller for uniformity. */
export function setTimeoutController(
  cb: () => void,
  delayMs: number,
): TimerController {
  const ms = toIntMs(delayMs);
  let id = window.setTimeout(cb, ms);
  return { clear: () => window.clearTimeout(id) };
}

/** @internal Replace any existing timer for `key` with `controller`. */
export function putTimer(
  map: TimerMap,
  key: string,
  controller: TimerController,
) {
  map[key]?.clear?.();
  map[key] = controller;
}

/** @internal Clear a specific key (noop if missing). */
export function clearKey(map: TimerMap, key: string) {
  map[key]?.clear?.();
  delete map[key];
}

/** @internal Clear several keys at once (noop on missing). */
export function clearKeys(map: TimerMap, keys: string[]) {
  for (const k of keys) clearKey(map, k);
}

/** @internal Clear all timers in the map. */
export function clearAll(map: TimerMap) {
  for (const k of Object.keys(map)) {
    map[k]?.clear?.();
    delete map[k];
  }
}

/**
 * @internal Convenience: set a capped timeout directly into the map for `key`.
 * @param map The map to store the timer in (pass in the ref to the timer map)
 * @param key The key to associate with the timer
 * @param cb The callback to invoke when the timer expires
 * @param delayMs The delay in milliseconds before the timer expires
 * */
export function setCappedTimeoutInMap(
  map: TimerMap,
  key: string,
  cb: () => void,
  delayMs: number,
) {
  putTimer(map, key, setCappedTimeout(cb, delayMs));
}

/**
 * @internal Convenience: set a regular (short) timeout into the map for `key`.
 * @param map The map to store the timer in (pass in the ref to the timer map)
 * @param key The key to associate with the timer
 * @param cb The callback to invoke when the timer expires
 * @param delayMs The delay in milliseconds before the timer expires
 */
export function setTimeoutInMap(
  map: TimerMap,
  key: string,
  cb: () => void,
  delayMs: number,
) {
  putTimer(map, key, setTimeoutController(cb, delayMs));
}
