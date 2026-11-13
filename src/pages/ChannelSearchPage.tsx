import { useEffect, useRef, useState } from 'react';
import { ChannelDetails } from '../components/ChannelDetails';
import { ChannelResultsTable } from '../components/ChannelResultsTable';
import { ChannelSearchForm } from '../components/ChannelSearchForm';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useChannelSearch } from '../hooks/useChannelSearch';
import type { searchChannels } from '../services/channelApi';
import type { ChannelRecord } from '../types/channel';

interface ChannelSearchPageProps {
  /** Injectable for tests. */
  searchFn?: typeof searchChannels;
}

export function ChannelSearchPage({ searchFn }: ChannelSearchPageProps) {
  const search = useChannelSearch(searchFn);
  const [selected, setSelected] = useState<ChannelRecord | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  // Drop the selection whenever a new result set arrives.
  useEffect(() => setSelected(null), [search.result]);

  useEffect(() => {
    if (selected && window.matchMedia?.('(max-width: 1099px)').matches) {
      detailsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
  }, [selected]);

  const channels = search.result?.channels ?? [];
  const loading = search.status === 'loading';
  const pageable = !!search.params && !search.params.channelArn;
  const from = search.params?.from ?? 0;

  return (
    <div className="page">
      <header className="page__header">
        <h1>Messaging channel search</h1>
        <p>Search the messaging-channels index via <code>GET /api/search/channels</code>.</p>
      </header>

      <ChannelSearchForm
        loading={loading}
        onSearch={(params) => search.search(params)}
        onClear={() => {
          search.reset();
          setSelected(null);
        }}
      />

      <div className={`page__body${selected ? ' page__body--with-details' : ''}`}>
        <section className="results" aria-label="Search results" aria-busy={loading}>
          {loading && <LoadingIndicator />}

          {search.status === 'error' && search.error && (
            <ErrorMessage
              message={search.error}
              onRetry={search.params ? () => search.search(search.params!, { force: true }) : undefined}
            />
          )}

          {search.status === 'idle' && <p className="results__placeholder">Enter one or more filters and press Search.</p>}

          {search.status === 'success' && channels.length === 0 && (
            <div className="results__empty" role="status">
              <strong>No channels match these filters.</strong>
              <span>Text filters are exact matches, so check casing and the full value.</span>
            </div>
          )}

          {channels.length > 0 && search.status !== 'error' && (
            <>
              <div className="results__toolbar">
                <span role="status">
                  {pageable
                    ? `Showing ${from + 1}–${from + channels.length}`
                    : `${channels.length} channel${channels.length === 1 ? '' : 's'}`}
                </span>
                <button
                  type="button"
                  className="btn btn--link"
                  disabled={loading}
                  onClick={() => search.params && search.search(search.params, { force: true })}
                >
                  Refresh
                </button>
              </div>

              <ChannelResultsTable
                channels={channels}
                selectedArn={selected?.membership.ChannelSummary.ChannelArn ?? null}
                onSelect={setSelected}
              />

              {pageable && (search.hasPrevPage || search.hasNextPage) && (
                <nav className="pagination" aria-label="Pagination">
                  <button type="button" className="btn btn--secondary" onClick={search.prevPage} disabled={!search.hasPrevPage || loading}>
                    Previous
                  </button>
                  <span>Page {search.page}</span>
                  <button type="button" className="btn btn--secondary" onClick={search.nextPage} disabled={!search.hasNextPage || loading}>
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
        </section>

        {selected && (
          <div className="page__details" ref={detailsRef}>
            <ChannelDetails channel={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
