/**
 * Client-side configuration. Only VITE_-prefixed variables reach the browser, and none of
 * them may hold secrets. The API token lives server-side in the Vite proxy (vite.config.ts).
 */
const rawBasePath = import.meta.env.VITE_API_BASE_PATH as string | undefined;

export const API_BASE_PATH = (rawBasePath && rawBasePath.trim() ? rawBasePath.trim() : '/api').replace(/\/+$/, '');

/** OpenSearch's default index.max_result_window. from + size beyond this makes the API return a bare 500. */
export const MAX_RESULT_WINDOW = 10_000;

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500, 1000] as const;
export const DEFAULT_PAGE_SIZE = 50;
