import { useId, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { PAGE_SIZE_OPTIONS } from '../config';
import type { SearchChannelsParams } from '../types/channel';
import {
  EMPTY_FORM,
  validateSearchForm,
  type SearchFormErrors,
  type SearchFormValues,
} from '../utils/searchForm';

interface ChannelSearchFormProps {
  onSearch: (params: SearchChannelsParams) => void;
  onClear: () => void;
  loading: boolean;
}

type FieldName = keyof SearchFormValues;

export function ChannelSearchForm({ onSearch, onClear, loading }: ChannelSearchFormProps) {
  const [values, setValues] = useState<SearchFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<SearchFormErrors>({});
  const idPrefix = useId();
  const arnMode = values.channelArn.trim() !== '';

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name as FieldName] || errors.form) {
      setErrors((prev) => ({ ...prev, [name]: undefined, form: undefined }));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const { errors: nextErrors, params } = validateSearchForm(values);
    setErrors(nextErrors);
    if (params) onSearch(params);
  };

  const handleClear = () => {
    setValues(EMPTY_FORM);
    setErrors({});
    onClear();
  };

  const field = (name: FieldName, label: string, input: ReactNode, hint?: string) => {
    const id = `${idPrefix}-${name}`;
    const error = errors[name];
    const disabled = arnMode && name !== 'channelArn' && name !== 'messagingUserId';
    return (
      <div className={`field${error ? ' field--error' : ''}${disabled ? ' field--disabled' : ''}`} key={name}>
        <label htmlFor={id}>{label}</label>
        {input}
        {error ? (
          <span className="field__error" id={`${id}-error`} role="alert">
            {error}
          </span>
        ) : hint ? (
          <span className="field__hint">{hint}</span>
        ) : null}
      </div>
    );
  };

  const inputProps = (name: FieldName, extra: Record<string, unknown> = {}) => {
    const id = `${idPrefix}-${name}`;
    const disabled = arnMode && name !== 'channelArn' && name !== 'messagingUserId';
    return {
      id,
      name,
      value: values[name],
      onChange: handleChange,
      disabled,
      'aria-invalid': errors[name] ? true : undefined,
      'aria-describedby': errors[name] ? `${id}-error` : undefined,
      ...extra,
    };
  };

  const text = (name: FieldName, extra: Record<string, unknown> = {}) => (
    <input type="text" autoComplete="off" spellCheck={false} {...inputProps(name, extra)} />
  );

  return (
    <form className="search-form" onSubmit={handleSubmit} noValidate aria-label="Channel search">
      <fieldset>
        <legend>Identifiers</legend>
        <div className="search-form__grid">
          {field(
            'channelArn',
            'Channel ARN',
            text('channelArn', { placeholder: 'arn:aws:chime:us-east-1:…/channel/…' }),
            'Exact match. When set, only Messaging User ID is also applied.',
          )}
          {field('messagingUserId', 'Messaging User ID', text('messagingUserId'), 'Channel member')}
          {field('adminId', 'Admin Messaging User ID', text('adminId'))}
          {field('candidateId', 'Candidate ID', text('candidateId'))}
          {field('jobId', 'Job ID', text('jobId'))}
          {field('publicId', 'Public ID', text('publicId'))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Channel</legend>
        <div className="search-form__grid">
          {field('name', 'Channel name', text('name'), 'Exact match (case-sensitive)')}
          {field('channelType', 'Channel type', text('channelType'))}
          {field('jtChannelType', 'JT channel type', text('jtChannelType'))}
          {field(
            'mode',
            'Mode',
            <select {...inputProps('mode')}>
              <option value="">Any</option>
              <option value="RESTRICTED">RESTRICTED</option>
              <option value="UNRESTRICTED">UNRESTRICTED</option>
            </select>,
          )}
          {field(
            'privacy',
            'Privacy',
            <select {...inputProps('privacy')}>
              <option value="">Any</option>
              <option value="PRIVATE">PRIVATE</option>
              <option value="PUBLIC">PUBLIC</option>
            </select>,
          )}
          {field(
            'videoInterview',
            'Video interview',
            <select {...inputProps('videoInterview')}>
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>,
          )}
          {field(
            'unread',
            'Read status',
            <select {...inputProps('unread')}>
              <option value="">Any</option>
              <option value="true">Unread by member</option>
              <option value="false">Read by member</option>
            </select>,
            'Requires Messaging User ID',
          )}
          {field('unreadCount', 'Unread count', text('unreadCount', { inputMode: 'numeric' }))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Dates (your local time)</legend>
        <div className="search-form__grid">
          {field('createdFrom', 'Created from', <input type="datetime-local" {...inputProps('createdFrom')} />)}
          {field('createdTo', 'Created to', <input type="datetime-local" {...inputProps('createdTo')} />)}
          {field('lastMessageFrom', 'Last message from', <input type="datetime-local" {...inputProps('lastMessageFrom')} />)}
          {field('lastMessageTo', 'Last message to', <input type="datetime-local" {...inputProps('lastMessageTo')} />)}
        </div>
      </fieldset>

      {errors.form && (
        <p className="search-form__form-error" role="alert">
          {errors.form}
        </p>
      )}

      <div className="search-form__actions">
        {field(
          'pageSize',
          'Page size',
          <select {...inputProps('pageSize')}>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>,
        )}
        <div className="search-form__buttons">
          <button type="button" className="btn btn--secondary" onClick={handleClear}>
            Clear filters
          </button>
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>
    </form>
  );
}
