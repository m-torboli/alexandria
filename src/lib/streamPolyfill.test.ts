import { describe, expect, it } from "vitest";

import { installReadableStreamAsyncIterator } from "./streamPolyfill";

/** Una copia di ReadableStream senza iterazione asincrona, come nei WebKit meno recenti. */
function legacyReadableStream(): typeof ReadableStream {
  class Legacy<R> extends ReadableStream<R> {}
  for (const key of [Symbol.asyncIterator, "values"] as const) {
    Object.defineProperty(Legacy.prototype, key, { value: undefined, configurable: true, writable: true });
  }
  return Legacy as unknown as typeof ReadableStream;
}

const streamOf = <T>(Ctor: typeof ReadableStream, items: T[], onCancel?: () => void) =>
  new Ctor<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
    cancel: onCancel,
  });

describe("installReadableStreamAsyncIterator", () => {
  it("non tocca i motori che supportano già l'iterazione", () => {
    expect(installReadableStreamAsyncIterator(ReadableStream)).toBe(false);
  });

  it("rende iterabile con for await uno stream che non lo era", async () => {
    const Legacy = legacyReadableStream();
    expect(installReadableStreamAsyncIterator(Legacy)).toBe(true);

    const seen: number[] = [];
    for await (const n of streamOf(Legacy, [1, 2, 3])) seen.push(n);
    expect(seen).toEqual([1, 2, 3]);
  });

  it("rilascia lo stream se il ciclo si interrompe prima della fine", async () => {
    const Legacy = legacyReadableStream();
    installReadableStreamAsyncIterator(Legacy);

    let cancelled = false;
    const stream = new Legacy<number>({
      pull(controller) {
        controller.enqueue(1);
      },
      cancel() {
        cancelled = true;
      },
    });
    for await (const _ of stream) break;
    expect(cancelled).toBe(true);
    expect(stream.locked).toBe(false);
  });

  it("propaga gli errori dello stream", async () => {
    const Legacy = legacyReadableStream();
    installReadableStreamAsyncIterator(Legacy);

    const stream = new Legacy({
      start(controller) {
        controller.error(new Error("rotto"));
      },
    });
    await expect(async () => {
      for await (const _ of stream) void _;
    }).rejects.toThrow("rotto");
  });
});
