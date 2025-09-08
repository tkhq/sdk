/**
 * @jest-environment jsdom
 */
import {
  MAX_DELAY_MS,
  setCappedTimeout,
  setTimeoutController,
  putTimer,
  clearKey,
  clearKeys,
  clearAll,
  setCappedTimeoutInMap,
  setTimeoutInMap,
  type TimerMap,
  type TimerController,
} from "../utils/timers";
import {
  describe,
  jest,
  beforeEach,
  afterEach,
  it,
  expect,
} from "@jest/globals";

describe("timer utilities", () => {
  beforeEach(() => {
    jest.useFakeTimers(); // modern fake timers
    jest.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("setTimeoutController", () => {
    it("schedules a one-shot timeout and fires once", () => {
      const cb = jest.fn();
      const ctl = setTimeoutController(cb, 1000);
      expect(typeof ctl.clear).toBe("function");

      jest.advanceTimersByTime(999);
      expect(cb).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("clear() cancels the timeout", () => {
      const cb = jest.fn();
      const ctl = setTimeoutController(cb, 1000);
      ctl.clear();

      jest.advanceTimersByTime(2000);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe("setCappedTimeout", () => {
    it("fires after a short delay (single leg)", () => {
      const cb = jest.fn();
      const ctl = setCappedTimeout(cb, 1500);

      // should not fire early
      jest.advanceTimersByTime(1499);
      expect(cb).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(cb).toHaveBeenCalledTimes(1);

      // clear is idempotent after firing
      ctl.clear();
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("supports arbitrarily long delays by hopping legs", () => {
      const cb = jest.fn();
      const spy = jest.spyOn(window, "setTimeout");
      const longDelay = MAX_DELAY_MS + 5000; // two legs: MAX then 5000

      setCappedTimeout(cb, longDelay);

      // First leg scheduled at MAX_DELAY_MS
      expect(spy).toHaveBeenCalledWith(expect.any(Function), MAX_DELAY_MS);

      // Advance first leg; second leg should be scheduled for remaining (5000)
      jest.advanceTimersByTime(MAX_DELAY_MS);
      expect(spy).toHaveBeenLastCalledWith(expect.any(Function), 5000);

      // Not fired yet
      expect(cb).not.toHaveBeenCalled();

      // Advance remaining 5s; callback fires
      jest.advanceTimersByTime(5000);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("clear() cancels future hops", () => {
      const cb = jest.fn();
      const ctl = setCappedTimeout(cb, MAX_DELAY_MS * 2 + 1234); // 3 legs: MAX, MAX, 1234

      // Cancel before anything elapses
      ctl.clear();

      // Even if we advance a long time, nothing should fire
      jest.advanceTimersByTime(MAX_DELAY_MS * 3);
      expect(cb).not.toHaveBeenCalled();
    });

    it("fires immediately when delay <= 0 or not finite", () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();

      // negative -> clamped to 0
      setCappedTimeout(cb1, -100);
      // NaN -> clamped to 0
      setCappedTimeout(cb2, Number.NaN as any);

      // tick() runs synchronously for remaining<=0
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  describe("map helpers", () => {
    let map: TimerMap;

    beforeEach(() => {
      map = {};
    });

    it("putTimer replaces an existing timer and clears the old one", () => {
      const oldClear = jest.fn();
      const newClear = jest.fn();

      const oldCtl: TimerController = { clear: oldClear };
      const newCtl: TimerController = { clear: newClear };

      putTimer(map, "sessionA", oldCtl);
      expect(map["sessionA"]).toBe(oldCtl);

      putTimer(map, "sessionA", newCtl);
      expect(oldClear).toHaveBeenCalledTimes(1);
      expect(map["sessionA"]).toBe(newCtl);
    });

    it("clearKey clears and deletes a single key", () => {
      const clear = jest.fn();
      map["k1"] = { clear };

      clearKey(map, "k1");
      expect(clear).toHaveBeenCalledTimes(1);
      expect(map["k1"]).toBeUndefined();

      // noop for missing key
      clearKey(map, "k1");
      expect(clear).toHaveBeenCalledTimes(1);
    });

    it("clearKeys batch-clears multiple keys", () => {
      const c1 = jest.fn();
      const c2 = jest.fn();
      const c3 = jest.fn();

      map["a"] = { clear: c1 };
      map["b"] = { clear: c2 };
      map["c"] = { clear: c3 };

      clearKeys(map, ["a", "c", "missing"]);
      expect(c1).toHaveBeenCalledTimes(1);
      expect(c2).not.toHaveBeenCalled();
      expect(c3).toHaveBeenCalledTimes(1);
      expect(map["a"]).toBeUndefined();
      expect(map["c"]).toBeUndefined();
      expect(map["b"]).toBeDefined();
    });

    it("clearAll clears everything and empties the map", () => {
      const c1 = jest.fn();
      const c2 = jest.fn();

      map["x"] = { clear: c1 };
      map["y"] = { clear: c2 };

      clearAll(map);
      expect(c1).toHaveBeenCalledTimes(1);
      expect(c2).toHaveBeenCalledTimes(1);
      expect(Object.keys(map)).toHaveLength(0);
    });

    it("setCappedTimeoutInMap stores a capped controller and fires", () => {
      const cb = jest.fn();

      setCappedTimeoutInMap(map, "cap", cb, 2000);
      expect(map["cap"]).toBeDefined();

      jest.advanceTimersByTime(1999);
      expect(cb).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("setTimeoutInMap stores a simple controller and fires", () => {
      const cb = jest.fn();

      setTimeoutInMap(map, "simple", cb, 1500);
      expect(map["simple"]).toBeDefined();

      jest.advanceTimersByTime(1500);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });
});
