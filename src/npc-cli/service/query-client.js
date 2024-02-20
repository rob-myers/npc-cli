import { QueryClient } from "@tanstack/react-query";

/**
 * Singleton instance for entire App.
 */
export const queryClient = new QueryClient();

export const queryCache = queryClient.getQueryCache();

/**
 * @param {string | string[]} queryKey
 * @returns {any | undefined}
 */
export function getCached(queryKey) {
  return queryCache.find({
    queryKey: Array.isArray(queryKey) ? queryKey : [queryKey],
  })?.state.data;
}

/**
 * @template T
 * @param {string[]} queryKey
 * @param {import('@tanstack/react-query').Updater<T | undefined, T>} updater
 */
export function setCached(queryKey, updater) {
  // 🚧 review options
  queryClient.setQueryDefaults(queryKey, {
    gcTime: Infinity,
    staleTime: Infinity,
  });
  queryClient.setQueryData(queryKey, updater);
}

/**
 * @param {string[]} queryKey
 */
export function removeCached(queryKey) {
  const query = queryCache.find({ queryKey });
  query && queryCache.remove(query);
}
