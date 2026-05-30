// Stub Web Worker for timer tests (jsdom doesn't support Workers)
if (typeof Worker === 'undefined') {
  global.Worker = class {
    onmessage: unknown;
    postMessage() {}
    terminate() {}
  } as unknown as typeof Worker;
}
