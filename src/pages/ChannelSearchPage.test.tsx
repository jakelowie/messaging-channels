import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChannelApiError } from '../services/channelApi';
import type { ChannelMembership, SearchChannelsParams, SearchChannelsResult } from '../types/channel';
import type { ChannelMessage } from '../types/message';
import { MESSAGES_CONCURRENCY } from '../hooks/useChannelMessages';
import { makeMembership, makeMessage, makeMetadata, makeResult } from '../test/fixtures';
import type { ListMessagesFn } from '../components/ChannelMessages';
import { ChannelSearchPage } from './ChannelSearchPage';

type SearchFn = (params: SearchChannelsParams, opts?: { signal?: AbortSignal }) => Promise<SearchChannelsResult>;

function setup(searchFn: SearchFn) {
  const fn = vi.fn(searchFn);
  const user = userEvent.setup();
  render(<ChannelSearchPage searchFn={fn} listMessagesFn={async () => []} />);
  return { fn, user };
}

const submit = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Search' }));

describe('ChannelSearchPage', () => {
  it('submits a search with the entered filter', async () => {
    const { fn, user } = setup(async () => makeResult([makeMembership()]));
    await user.type(screen.getByLabelText('Candidate ID'), 'CAND-200');
    await submit(user);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toMatchObject({ candidateId: 'CAND-200', size: 50, from: 0 });
  });

  it('combines multiple filters in one request', async () => {
    const { fn, user } = setup(async () => makeResult([]));
    await user.type(screen.getByLabelText('Job ID'), 'JOB-1');
    await user.type(screen.getByLabelText('Messaging User ID'), 'user-1');
    await user.selectOptions(screen.getByLabelText('Video interview'), 'true');
    await user.selectOptions(screen.getByLabelText('Read status'), 'true');
    await submit(user);

    expect(fn.mock.calls[0][0]).toMatchObject({ jobId: 'JOB-1', messagingUserId: 'user-1', videoInterview: true, unread: true });
  });

  it('shows a loading indicator, then the results table', async () => {
    let resolve!: (r: SearchChannelsResult) => void;
    const { user } = setup(() => new Promise((r) => (resolve = r)));
    await user.type(screen.getByLabelText('Job ID'), 'JOB-100');
    await submit(user);

    expect(screen.getByRole('status', { name: '' })).toHaveTextContent(/searching channels/i);
    expect(screen.getByRole('button', { name: /searching/i })).toBeDisabled();

    resolve(makeResult([makeMembership({ name: 'Alpha channel' }), makeMembership({ name: 'Beta channel' })]));

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Alpha channel')).toBeInTheDocument();
    expect(within(table).getByText('Beta channel')).toBeInTheDocument();
    expect(within(table).getAllByText('CAND-200')).toHaveLength(2);
    expect(screen.queryByText(/searching channels/i)).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', async () => {
    const { user } = setup(async () => makeResult([]));
    await user.type(screen.getByLabelText('Job ID'), 'nope');
    await submit(user);
    expect(await screen.findByText(/no channels match/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a friendly error and can retry', async () => {
    let call = 0;
    const { fn, user } = setup(async () => {
      call += 1;
      if (call === 1) throw new ChannelApiError('The messaging API rejected the credentials.', 401);
      return makeResult([makeMembership({ name: 'Recovered' })]);
    });
    await user.type(screen.getByLabelText('Job ID'), 'JOB-1');
    await submit(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/rejected the credentials/i);

    await user.click(within(alert).getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Recovered')).toBeInTheDocument();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('shows full channel details for a selected row', async () => {
    const membership = makeMembership({
      name: 'Detail channel',
      metadata: makeMetadata({ Members: ['ext-a-b-Recruiter', 'cand-1-Jobseeker'], Cadences: { jobseeker: 11, recruiter: 22 } }),
    });
    const { user } = setup(async () => makeResult([membership]));
    await user.type(screen.getByLabelText('Job ID'), 'JOB-100');
    await submit(user);

    await user.click(await screen.findByRole('button', { name: /view details for detail channel/i }));

    const details = screen.getByRole('region', { name: 'Detail channel' });
    expect(within(details).getByText(membership.ChannelSummary.ChannelArn)).toBeInTheDocument();
    expect(within(details).getByText('admin-user-1')).toBeInTheDocument();
    // Member "ext-a-b-Recruiter" splits on the last hyphen.
    expect(within(details).getByText('ext-a-b')).toBeInTheDocument();
    expect(within(details).getByText('Recruiter')).toBeInTheDocument();
    expect(within(details).getByText('11')).toBeInTheDocument();
    expect(within(details).getByText('22')).toBeInTheDocument();
    expect(within(details).getByText('other-user-1', { selector: 'li' })).toBeInTheDocument();

    expect(within(details).queryByText(/"ChannelArn"/)).not.toBeInTheDocument();
    await user.click(within(details).getByRole('button', { name: /show raw json/i }));
    expect(within(details).getByText(/"ChannelArn"/)).toBeInTheDocument();

    await user.click(within(details).getByRole('button', { name: /close details/i }));
    expect(screen.queryByRole('region', { name: 'Detail channel' })).not.toBeInTheDocument();
  });

  it('paginates with from/size when a page comes back full', async () => {
    const { fn, user } = setup(async (params) =>
      makeResult(Array.from({ length: params.from === 0 ? 25 : 3 }, () => makeMembership())),
    );
    await user.type(screen.getByLabelText('Job ID'), 'JOB-1');
    await user.selectOptions(screen.getByLabelText('Page size'), '25');
    await submit(user);

    const next = await screen.findByRole('button', { name: 'Next' });
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await user.click(next);

    await screen.findByText('Showing 26–28');
    expect(fn.mock.calls[1][0]).toMatchObject({ jobId: 'JOB-1', size: 25, from: 25 });
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    await screen.findByText('Showing 1–25');
    // Page 1 comes from the cache, not a new request.
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('validates inputs before calling the API', async () => {
    const { fn, user } = setup(async () => makeResult([]));
    await submit(user);
    expect(await screen.findByText(/at least one filter/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Channel ARN'), 'bad-arn');
    await submit(user);
    expect(await screen.findByText(/Expected a Chime channel ARN/)).toBeInTheDocument();
    expect(screen.getByLabelText('Channel ARN')).toHaveAttribute('aria-invalid', 'true');
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not send duplicate requests for an identical search', async () => {
    let resolve!: (r: SearchChannelsResult) => void;
    const { fn, user } = setup(() => new Promise((r) => (resolve = r)));
    await user.type(screen.getByLabelText('Job ID'), 'JOB-1');
    await submit(user);
    // Button is disabled while loading; Enter in a field must not resend either.
    await user.type(screen.getByLabelText('Job ID'), '{Enter}');
    expect(fn).toHaveBeenCalledTimes(1);

    resolve(makeResult([makeMembership()]));
    await screen.findByRole('table');
    await submit(user);
    expect(fn).toHaveBeenCalledTimes(1); // served from cache
  });

  it('clears filters and results', async () => {
    const { user } = setup(async () => makeResult([makeMembership({ name: 'To clear' })]));
    const jobInput = screen.getByLabelText('Job ID');
    await user.type(jobInput, 'JOB-1');
    await submit(user);
    await screen.findByText('To clear');

    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(jobInput).toHaveValue('');
    await waitFor(() => expect(screen.queryByText('To clear')).not.toBeInTheDocument());
    expect(screen.getByText(/enter one or more filters/i)).toBeInTheDocument();
  });


  describe('Messages button', () => {
    function setupWithMessages(
      listMessagesFn: ListMessagesFn,
      memberships: ChannelMembership[] = [makeMembership({ name: 'Msg channel' })],
    ) {
      const listFn = vi.fn(listMessagesFn);
      const user = userEvent.setup();
      render(<ChannelSearchPage searchFn={async () => makeResult(memberships)} listMessagesFn={listFn} />);
      return { listFn, user, memberships };
    }

    async function runSearch(user: ReturnType<typeof userEvent.setup>, extra?: () => Promise<void>) {
      await user.type(screen.getByLabelText('Job ID'), 'JOB-100');
      await extra?.();
      await submit(user);
      await screen.findByRole('table');
    }

    it('checks every channel up front and turns the button green when it has messages', async () => {
      const { listFn, user, memberships } = setupWithMessages(async () => [
        makeMessage({ Content: 'Hi there', Sender: { Arn: 'arn:s1', Name: 'Jane Recruiter' } }),
        makeMessage({ Content: 'Hello back', Sender: { Arn: 'arn:s2', Name: 'Sam Candidate' } }),
      ]);
      await runSearch(user);

      const button = await screen.findByRole('button', { name: 'Messages for Msg channel' });
      expect(button).toBeEnabled();
      expect(button).toHaveClass('btn--success');
      // Fetched without clicking, listed as the channel admin.
      expect(listFn).toHaveBeenCalledTimes(1);
      expect(listFn.mock.calls[0][0]).toEqual({
        channelArn: memberships[0].ChannelSummary.ChannelArn,
        messagingUserId: 'admin-user-1',
      });

      await user.click(button);
      expect(screen.getByText('Hi there')).toBeInTheDocument();
      expect(screen.getByText('Jane Recruiter')).toBeInTheDocument();
      expect(screen.getByText('Hello back')).toBeInTheDocument();
      expect(screen.getByText('Sam Candidate')).toBeInTheDocument();
      // Opening reuses the prefetched messages and doesn't open the details pane.
      expect(listFn).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('region', { name: 'Msg channel' })).not.toBeInTheDocument();

      await user.click(button);
      expect(screen.queryByText('Hi there')).not.toBeInTheDocument();
    });

    it('disables the button while checking and when the channel has no messages', async () => {
      let resolve!: (messages: ChannelMessage[]) => void;
      const { user } = setupWithMessages(() => new Promise((r) => (resolve = r)));
      await runSearch(user);

      const checking = screen.getByRole('button', { name: 'Checking messages for Msg channel' });
      expect(checking).toBeDisabled();

      resolve([]);
      const none = await screen.findByRole('button', { name: 'No messages for Msg channel' });
      expect(none).toBeDisabled();
      expect(none).not.toHaveClass('btn--success');
      expect(none).toHaveAttribute('title', 'NO MESSAGES FOR THIS CHANNEL YET');
    });

    it('lists messages as the searched Messaging User ID when one was given', async () => {
      const { listFn, user } = setupWithMessages(async () => []);
      await runSearch(user, () => user.type(screen.getByLabelText('Messaging User ID'), 'searcher-1'));
      await waitFor(() => expect(listFn).toHaveBeenCalled());
      expect(listFn.mock.calls[0][0].messagingUserId).toBe('searcher-1');
    });

    it('keeps the button clickable on error and can retry', async () => {
      let call = 0;
      const { listFn, user } = setupWithMessages(async () => {
        call += 1;
        if (call === 1) throw new ChannelApiError('The messaging API is unavailable.', 503);
        return [makeMessage({ Content: 'After retry' })];
      });
      await runSearch(user);

      const button = await screen.findByRole('button', { name: 'Messages for Msg channel' });
      await waitFor(() => expect(button).toBeEnabled());
      expect(button).not.toHaveClass('btn--success');
      await user.click(button);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/unavailable/i);
      await user.click(within(alert).getByRole('button', { name: /try again/i }));
      expect(await screen.findByText('After retry')).toBeInTheDocument();
      expect(listFn).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('button', { name: 'Messages for Msg channel' })).toHaveClass('btn--success');
    });

    it('does not call the API when the channel has no admin to list messages as', async () => {
      const { listFn, user } = setupWithMessages(
        async () => [],
        [makeMembership({ name: 'Msg channel', metadata: makeMetadata({ Admin: '' }) })],
      );
      await runSearch(user);
      await user.click(await screen.findByRole('button', { name: 'Messages for Msg channel' }));
      expect(await screen.findByText(/has no admin/i)).toBeInTheDocument();
      expect(listFn).not.toHaveBeenCalled();
    });

    it(`keeps at most ${MESSAGES_CONCURRENCY} requests in flight`, async () => {
      let inFlight = 0;
      let peak = 0;
      const memberships = Array.from({ length: 20 }, () => makeMembership());
      const { listFn, user } = setupWithMessages(async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight -= 1;
        return [makeMessage()];
      }, memberships);
      await runSearch(user);

      await waitFor(() => expect(listFn).toHaveBeenCalledTimes(20));
      await waitFor(() => expect(screen.getAllByRole('button', { name: /^Messages for/ })).toHaveLength(20));
      expect(peak).toBeLessThanOrEqual(MESSAGES_CONCURRENCY);
    });
  });
});
