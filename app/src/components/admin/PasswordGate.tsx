import { useState, type FormEvent } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { DataNote } from '../ui/states';

/**
 * Asks for the shared admin password before showing the upload tools.
 *
 * This hides the UI; it does not protect anything on its own. Every write
 * endpoint checks the password server-side, so someone who skips this screen
 * and calls the API directly is still refused.
 */
export function PasswordGate({
  onSubmit,
  error,
}: {
  onSubmit: (password: string) => void;
  error?: string | null;
}) {
  const [value, setValue] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  }

  return (
    <div className="mx-auto max-w-md">
      <Card label="Admin password">
        <h1 className="font-display text-lg font-bold text-ink-1">Internal team area</h1>
        <p className="mt-1 text-ink-3">
          Enter the shared password to upload campaign data.
        </p>

        <form onSubmit={submit} className="mt-4">
          <label className="block">
            <span className="text-micro font-semibold uppercase tracking-wide text-ink-4">
              Password
            </span>
            <input
              type="password"
              value={value}
              autoFocus
              autoComplete="current-password"
              onChange={(e) => setValue(e.target.value)}
              className="mt-1 w-full rounded-control border border-line-1 bg-surface-1 px-3 py-2 text-ink-1"
            />
          </label>

          {error && (
            <p role="alert" className="mt-2 text-micro font-semibold text-danger">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" className="mt-4 w-full" disabled={!value.trim()}>
            Continue
          </Button>
        </form>

        <div className="mt-5">
          <DataNote>
            This password is shared, so an upload is recorded as{' '}
            <span className="font-mono">anonymous</span> rather than against a person. Reporting
            pages are readable by anyone with the link.
          </DataNote>
        </div>
      </Card>
    </div>
  );
}
