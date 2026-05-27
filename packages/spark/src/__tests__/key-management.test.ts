import { describe } from "node:test";
import { TurnkeyKeyManager } from "../key-management";

describe("TurnkeyKeyManager", () => {
  describe("get", () => {
    it("should return undefined if fetch is not implemented and a key is not present", async () => {
      class TestManager extends TurnkeyKeyManager<string> {}

      const manager = new TestManager();
      const result = await manager.get("test");

      expect(result).toBeUndefined();
    });

    it("should throw if fetch throws and a key is not present", async () => {
      const error = new Error("Fetch error");
      const fetchSpy = jest.fn().mockRejectedValue(error);
      class TestManager extends TurnkeyKeyManager<string> {
        override fetch = fetchSpy;
      }

      const manager = new TestManager();

      await expect(manager.get("test")).rejects.toThrow(error);
    });

    it("should refetch if fetch throws and a key is not present", async () => {
      const error1 = new Error("Fetch error 1");
      const error2 = new Error("Fetch error 2");
      const value = new Uint8Array([1, 2, 3]);
      const fetchSpy = jest
        .fn()
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValue(value);
      class TestManager extends TurnkeyKeyManager<string> {
        override fetch = fetchSpy;
      }

      const manager = new TestManager();

      await expect(manager.get("test")).rejects.toThrow(error1);
      await expect(manager.get("test")).rejects.toThrow(error2);

      const result = await manager.get("test");
      expect(result).toBe(value);
    });

    it("should not refetch an existing value", async () => {
      const value = new Uint8Array([1, 2, 3]);
      const fetchSpy = jest.fn().mockResolvedValue(value);
      class TestManager extends TurnkeyKeyManager<string> {
        override fetch = fetchSpy;
      }

      const manager = new TestManager();
      const result = await manager.get("test");
      expect(result).toBe(value);

      const resultAgain = await manager.get("test");
      expect(resultAgain).toBe(value);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith("test");
    });

    it("should not refetch if a fetch is already in progress", async () => {
      let resolve: (value: Uint8Array) => void;
      const promise = new Promise<Uint8Array>((res) => {
        resolve = res;
      });

      const value = new Uint8Array([1, 2, 3]);
      const fetchSpy = jest.fn().mockReturnValue(promise);
      class TestManager extends TurnkeyKeyManager<string> {
        override fetch = fetchSpy;
      }

      const manager = new TestManager();
      const resultPromise = manager.get("test");
      const resultAgainPromise = manager.get("test");

      resolve!(value);

      const result = await resultPromise;
      const resultAgain = await resultAgainPromise;

      expect(result).toBe(value);
      expect(resultAgain).toBe(value);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith("test");
    });

    it("should not create race conditions if value is being set during a fetch", async () => {
      let resolve: (value: Uint8Array) => void;
      const promise = new Promise<Uint8Array>((res) => {
        resolve = res;
      });

      const fetchedValue = new Uint8Array([1, 2, 3]);
      const storedValue = new Uint8Array([4, 5, 6]);
      const fetchSpy = jest.fn().mockReturnValue(promise);
      class TestManager extends TurnkeyKeyManager<string> {
        override fetch = fetchSpy;
      }

      const manager = new TestManager();
      const resultPromise = manager.get("test");

      manager.set("test", storedValue);

      resolve!(fetchedValue);

      const result = await resultPromise;

      expect(result).toBe(storedValue);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith("test");
    });

    it("should return a stored values if key is present", async () => {
      class TestManager extends TurnkeyKeyManager<string> {}

      const manager = new TestManager();

      const key = "test";
      const value = new Uint8Array([1, 2, 3]);

      manager.set(key, value);
      const result = await manager.get(key);

      expect(result).toBe(value);
    });
  });

  describe("set", () => {
    it("should store the value for a key", async () => {
      class TestManager extends TurnkeyKeyManager<string> {}

      const manager = new TestManager();

      const key = "test";
      const value = new Uint8Array([1, 2, 3]);

      manager.set(key, value);
      const result = await manager.get(key);

      expect(result).toBe(value);
    });

    it("should wipe an existing value before setting a new value for the same key", async () => {
      class TestManager extends TurnkeyKeyManager<string> {}

      const manager = new TestManager();

      const key = "test";
      const oldValue = new Uint8Array([1, 2, 3]);
      const newValue = new Uint8Array([4, 5, 6]);

      manager.set(key, oldValue);
      manager.set(key, newValue);

      const result = await manager.get(key);
      expect(result).toBe(newValue);
      expect(oldValue).toEqual(new Uint8Array([0, 0, 0]));
    });

    it("should not overwrite a value with itself", async () => {
      class TestManager extends TurnkeyKeyManager<string> {}

      const manager = new TestManager();

      const key = "test";
      const value = new Uint8Array([1, 2, 3]);

      manager.set(key, value);
      manager.set(key, value);

      const result = await manager.get(key);

      expect(value).toEqual(new Uint8Array([1, 2, 3]));
      expect(result).toEqual(new Uint8Array([1, 2, 3]));
    });
  });

  describe("delete", () => {
    it("should not do anything if a key does not exist", async () => {
      class TestManager extends TurnkeyKeyManager<string> {}

      const manager = new TestManager();

      const key = "test";
      manager.delete(key);

      const result = await manager.get(key);
      expect(result).toBeUndefined();
    });

    it("should wipe an existing value", async () => {
      class TestManager extends TurnkeyKeyManager<string> {}

      const manager = new TestManager();

      const key = "test";
      const value = new Uint8Array([1, 2, 3]);

      manager.set(key, value);
      manager.delete(key);

      const result = await manager.get(key);
      expect(result).toBeUndefined();
      expect(value).toEqual(new Uint8Array([0, 0, 0]));
    });

    it("should not create race conditions if value is being deleted during a fetch", async () => {
      let resolve: (value: Uint8Array) => void;
      const promise = new Promise<Uint8Array>((res) => {
        resolve = res;
      });

      const fetchedValue = new Uint8Array([1, 2, 3]);
      const fetchSpy = jest.fn().mockReturnValue(promise);
      class TestManager extends TurnkeyKeyManager<string> {
        override fetch = fetchSpy;
      }

      const key = "test";
      const manager = new TestManager();
      const resultPromise = manager.get(key);

      manager.delete(key);

      resolve!(fetchedValue);

      const result = await resultPromise;
      expect(result).toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(key);
    });
  });
});
