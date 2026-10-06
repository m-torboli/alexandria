// PDF.js (dalla versione 5) legge il testo delle pagine con
// `for await (const chunk of readableStream)`, cioè con l'iterazione asincrona
// di ReadableStream. Chrome/Edge la supportano dalla 124, ma WebKit (il motore
// di Safari usato da Tauri su macOS) l'ha introdotta solo di recente: senza,
// `page.getTextContent()` fallisce e l'importazione non trova né testo né DOI.
// Lo stesso vale per il livello di testo e la ricerca nel lettore.
//
// Questo modulo aggiunge l'iterazione dove manca, seguendo la specifica WHATWG
// (https://streams.spec.whatwg.org/#rs-asynciterator). Non fa nulla se il
// motore la offre già.

type IteratorOptions = { preventCancel?: boolean };

export function installReadableStreamAsyncIterator(target: typeof ReadableStream | undefined = globalThis.ReadableStream) {
  const proto = target?.prototype as (ReadableStream & { values?: unknown }) | undefined;
  if (!proto || typeof (proto as unknown as Record<symbol, unknown>)[Symbol.asyncIterator] === "function") {
    return false;
  }

  function values<R>(this: ReadableStream<R>, options?: IteratorOptions): AsyncIterableIterator<R> {
    const reader = this.getReader();
    const preventCancel = Boolean(options?.preventCancel);
    let finished = false;

    const finish = () => {
      finished = true;
      reader.releaseLock();
    };

    return {
      async next(): Promise<IteratorResult<R>> {
        if (finished) return { done: true, value: undefined };
        try {
          const result = await reader.read();
          if (result.done) finish();
          return result as IteratorResult<R>;
        } catch (error) {
          finish();
          throw error;
        }
      },
      async return(value?: unknown): Promise<IteratorResult<R>> {
        if (!finished) {
          finished = true;
          try {
            if (!preventCancel) await reader.cancel(value);
          } finally {
            reader.releaseLock();
          }
        }
        return { done: true, value: value as R };
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  }

  const descriptor = { value: values, writable: true, configurable: true, enumerable: false };
  Object.defineProperty(proto, Symbol.asyncIterator, descriptor);
  if (typeof proto.values !== "function") Object.defineProperty(proto, "values", descriptor);
  return true;
}

installReadableStreamAsyncIterator();
