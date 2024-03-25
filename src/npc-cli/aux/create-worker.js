/** Web worker for TestWorker.jsx */
export const testWorkerWorker = new Worker(new URL("./test-worker.worker.jsx", import.meta.url), {
  type: "module",
});
