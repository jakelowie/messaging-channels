import { describe, expect, it } from 'vitest';
import { EMPTY_FORM, localDateTimeToRfc3339, validateSearchForm } from './searchForm';

const ARN = 'arn:aws:chime:us-east-1:123456789012:app-instance/app-1/channel/ch-1';

describe('validateSearchForm', () => {
  it('requires at least one filter', () => {
    const { errors, params } = validateSearchForm(EMPTY_FORM);
    expect(params).toBeNull();
    expect(errors.form).toMatch(/at least one filter/i);
  });

  it('rejects a malformed channel ARN', () => {
    const { errors } = validateSearchForm({ ...EMPTY_FORM, channelArn: 'not-an-arn' });
    expect(errors.channelArn).toMatch(/Chime channel ARN/);
  });

  it('rejects whitespace inside ids', () => {
    const { errors } = validateSearchForm({ ...EMPTY_FORM, jobId: 'JOB 1' });
    expect(errors.jobId).toMatch(/spaces/);
  });

  it('requires messagingUserId for read/unread filtering', () => {
    const { errors } = validateSearchForm({ ...EMPTY_FORM, jobId: 'J', unread: 'true' });
    expect(errors.unread).toMatch(/Messaging User ID/);
  });

  it('requires a whole-number unread count', () => {
    expect(validateSearchForm({ ...EMPTY_FORM, unreadCount: '-1' }).errors.unreadCount).toBeDefined();
    expect(validateSearchForm({ ...EMPTY_FORM, unreadCount: '2' }).errors.unreadCount).toBeUndefined();
  });

  it('rejects reversed date ranges', () => {
    const { errors } = validateSearchForm({ ...EMPTY_FORM, createdFrom: '2026-05-02T00:00', createdTo: '2026-05-01T00:00' });
    expect(errors.createdTo).toBeDefined();
  });

  it('combines multiple filters into API params', () => {
    const { errors, params } = validateSearchForm({
      ...EMPTY_FORM,
      candidateId: ' CAND-1 ',
      jobId: 'JOB-1',
      videoInterview: 'true',
      messagingUserId: 'user-1',
      unread: 'false',
      privacy: 'PRIVATE',
      createdFrom: '2026-01-01T00:00',
      pageSize: '100',
    });
    expect(errors).toEqual({});
    expect(params).toMatchObject({
      candidateId: 'CAND-1',
      jobId: 'JOB-1',
      videoInterview: true,
      messagingUserId: 'user-1',
      unread: false,
      privacy: 'PRIVATE',
      createdTimestampFrom: localDateTimeToRfc3339('2026-01-01T00:00'),
      size: 100,
      from: 0,
    });
    expect(params?.createdTimestampFrom).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('sends only channelArn + messagingUserId when an ARN is given (API ignores the rest)', () => {
    const { params } = validateSearchForm({ ...EMPTY_FORM, channelArn: ARN, messagingUserId: 'u', jobId: 'ignored' });
    expect(params).toEqual({ channelArn: ARN, messagingUserId: 'u' });
  });
});
