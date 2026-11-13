import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_RESULT_WINDOW } from '../config';
import { buildSearchQuery, ChannelApiError, searchChannels as defaultSearchChannels } from '../services/channelApi';
import type { SearchChannelsParams, SearchChannelsResult } from '../types/channel';

export type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ChannelSearchState {
  status: SearchStatus;
  result: SearchChannelsResult | null;
  error: string | null;
  /** Params of the most recent search (including from/size). */
  params: SearchChannelsParams | null;
}

export interface UseChannelSearch extends ChannelSearchState {
  search: (params: SearchChannelsParams, options?: { force?: boolean }) => void;
  nextPage: () => void;
  prevPage: () => void;
  reset: () => void;
  /** 1-based page number for display. */
  page: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const CACHE_LIMIT = 20;
const INITIAL: ChannelSearchState = { status: 'idle', result: null, error: null, params: null };

/**
 * Search state + request management:
 *  - identical in-flight requests are not re-sent;
 *  - a new search aborts the previous in-flight one (no out-of-order results);
 *  - recent results are cached per query string (pass { force: true } to bypass).
 */
export function useChannelSearch(searchFn: typeof defaultSearchChannels = defaultSearchChannels): UseChannelSearch {
  const [state, setState] = useState<ChannelSearchState>(INITIAL);
  const controllerRef = useRef<AbortController | null>(null);
  const inFlightKeyRef = useRef<string | null>(null);
  const cacheRef = useRef(new Map<string, SearchChannelsResult>());

  useEffect(() => () => controllerRef.current?.abort(), []);

  const search = useCallback(
    (params: SearchChannelsParams, options: { force?: boolean } = {}) => {
      const key = buildSearchQuery(params);
      if (inFlightKeyRef.current === key) return;

      const cached = cacheRef.current.get(key);
      if (cached && !options.force) {
        controllerRef.current?.abort();
        inFlightKeyRef.current = null;
        setState({ status: 'success', result: cached, error: null, params });
        return;
      }

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      inFlightKeyRef.current = key;
      setState((prev) => ({ ...prev, status: 'loading', error: null, params }));

      searchFn(params, { signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return;
          const cache = cacheRef.current;
          cache.delete(key);
          cache.set(key, result);
          if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
          setState({ status: 'success', result, error: null, params });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          const message =
            err instanceof ChannelApiError ? err.message : 'Something went wrong while searching. Please try again.';
          setState({ status: 'error', result: null, error: message, params });
        })
        .finally(() => {
          if (controllerRef.current === controller) {
            inFlightKeyRef.current = null;
          }
        });
    },
    [searchFn],
  );

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    inFlightKeyRef.current = null;
    setState(INITIAL);
  }, []);

  const { params, result, status } = state;
  // channelArn searches ignore paging server-side.
  const pageable = !!params && !params.channelArn && typeof params.size === 'number';
  const size = params?.size ?? 0;
  const from = params?.from ?? 0;
  // No total count is returned, so "full page" is the only signal that more may exist.
  // Also stop before from + size would exceed OpenSearch's result window (the API would 500).
  const hasNextPage =
    pageable &&
    status === 'success' &&
    size > 0 &&
    (result?.channels.length ?? 0) >= size &&
    from + 2 * size <= MAX_RESULT_WINDOW;
  const hasPrevPage = pageable && from > 0;

  const nextPage = useCallback(() => {
    if (!params || !hasNextPage) return;
    search({ ...params, from: (params.from ?? 0) + (params.size ?? 0) });
  }, [params, hasNextPage, search]);

  const prevPage = useCallback(() => {
    if (!params || !hasPrevPage) return;
    search({ ...params, from: Math.max(0, (params.from ?? 0) - (params.size ?? 0)) });
  }, [params, hasPrevPage, search]);

  return {
    ...state,
    search,
    nextPage,
    prevPage,
    reset,
    page: pageable && size > 0 ? Math.floor(from / size) + 1 : 1,
    hasNextPage,
    hasPrevPage,
  };
}
