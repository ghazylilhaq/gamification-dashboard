import { Link } from 'react-router-dom';
import { Card } from './ui/Card';
import { EmptyState } from './ui/states';
import { useDashboard } from '@/hooks/useDashboard';

/**
 * Shown on every reporting page while the database is empty.
 *
 * A fresh deployment has no data at all, and a dozen individually-empty panels
 * would leave a viewer guessing whether the campaign is quiet or the upload
 * simply has not happened. This says which.
 */
export function FirstRun({ page }: { page: string }) {
  const { raw } = useDashboard();
  const canUpload = raw?.viewer.canUpload ?? false;

  return (
    <Card label={page}>
      <EmptyState
        title="No data has been uploaded yet"
        description={
          canUpload
            ? 'Upload the reference files (blindbox and blindbox_reward) and the daily exports in the Admin area, and this page will fill in.'
            : 'The campaign team has not published any exports yet. This page will fill in once they do.'
        }
        action={
          canUpload ? (
            <Link
              to="/admin/upload"
              className="inline-flex items-center rounded-control bg-allo-yellow px-3 py-2 font-semibold text-ink-1 transition-colors hover:bg-allo-yellow-tint"
            >
              Go to Admin upload
            </Link>
          ) : undefined
        }
      />
    </Card>
  );
}
