export const worker = new Worker(new URL('./worker.jsx', import.meta.url), { type: 'module' });
