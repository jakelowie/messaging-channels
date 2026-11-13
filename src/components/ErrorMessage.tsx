interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="error-message" role="alert">
      <strong>Search failed.</strong> <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn--secondary btn--small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
