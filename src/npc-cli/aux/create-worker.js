/** Web worker for TestWorker.jsx */
export const testWorkerWorker = new Worker(new URL("./test-worker.worker.jsx", import.meta.url), {
  type: "module",
});

/** Web worker for TestWorldScene.jsx */
export const testWorldSceneWorker = new Worker(
  new URL("./test-world-scene.worker.jsx", import.meta.url),
  {
    type: "module",
  }
);
