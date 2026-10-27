import { AlertTriangle, SearchX, PackageOpen, Inbox, type LucideIcon } from 'lucide-react';
import { Button } from './button';

interface StateProps {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  icon?: LucideIcon;
  className?: string;
}

const container =
  'flex flex-col items-center justify-center gap-3 px-8 py-14 text-center animate-fade-in';

function Icon({ icon: IconComp, tone }: { icon?: LucideIcon; tone: string }) {
  const Icon_ = IconComp ?? Inbox;
  return (
    <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${tone}`}>
      <Icon_ className="h-8 w-8" />
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: StateProps) {
  return (
    <div className={container}>
      <Icon icon={icon} tone="bg-neutral-100 text-neutral-500" />
      <div>
        <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
      </div>
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', description, action, icon = AlertTriangle }: StateProps) {
  return (
    <div className={container}>
      <Icon icon={icon} tone="bg-danger/10 text-danger" />
      <div>
        <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
        {description && <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>}
      </div>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function NoResultsState({ query, onClear }: { query?: string; onClear?: () => void }) {
  return (
    <div className={container}>
      <Icon icon={SearchX} tone="bg-neutral-100 text-neutral-500" />
      <div>
        <h3 className="text-base font-semibold text-neutral-900">No results found</h3>
        {query ? (
          <p className="mt-1 text-sm text-neutral-500">
            We couldn't find anything matching “{query}”. Try a different search.
          </p>
        ) : (
          <p className="mt-1 text-sm text-neutral-500">Try adjusting your filters or search.</p>
        )}
      </div>
      {onClear && (
        <Button variant="secondary" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

export function GenericEmpty({ title, description, action, icon = PackageOpen }: StateProps) {
  return <EmptyState title={title} description={description} action={action} icon={icon} />;
}
