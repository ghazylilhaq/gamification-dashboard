import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/states';

export function NotFound() {
  return (
    <Card>
      <EmptyState
        title="Page not found"
        description="That address does not exist on this dashboard."
        action={
          <Link to="/" className="font-semibold text-info hover:underline">
            Back to Overview
          </Link>
        }
      />
    </Card>
  );
}
