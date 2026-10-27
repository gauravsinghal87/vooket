import type { SelectedOption } from '@/types/models';
import { Price } from '@/components/ui/price';
import { selectedOptionPrice } from '@/lib/productOptions';
import { cn, formatCurrency } from '@/lib/utils';

interface SelectedOptionsListProps {
  options: SelectedOption[] | null | undefined;
  className?: string;
  compact?: boolean;
  inline?: boolean;
}

function groupByGroup(options: SelectedOption[]) {
  const groups: { id: number; name: string; options: SelectedOption[] }[] = [];

  for (const option of options) {
    const existing = groups.find((g) => g.id === option.group_id);
    if (existing) {
      existing.options.push(option);
    } else {
      groups.push({ id: option.group_id, name: option.group_name, options: [option] });
    }
  }

  return groups;
}

function optionText(option: SelectedOption) {
  const price = selectedOptionPrice(option);
  return price > 0 ? `${option.option_name} +${formatCurrency(price)}` : option.option_name;
}

export function SelectedOptionsList({ options, className, compact = false, inline = false }: SelectedOptionsListProps) {
  if (!options || options.length === 0) return null;

  if (inline) {
    const groups = groupByGroup(options);

    return (
      <div className={cn('min-w-0 space-y-0.5', className)}>
        {groups.map((group) => (
          <p
            key={group.id}
            className="truncate text-[11px] text-neutral-500"
            title={`${group.name}: ${group.options.map(optionText).join(' · ')}`}
          >
            <span className="font-semibold text-neutral-600">{group.name}:</span>{' '}
            {group.options.map((option, i) => (
              <span key={option.option_id}>
                {i > 0 && <span className="text-neutral-300"> · </span>}
                {optionText(option)}
              </span>
            ))}
          </p>
        ))}
      </div>
    );
  }

  return (
    <ul className={cn('space-y-0.5', className)}>
      {options.map((o) => {
        const price = selectedOptionPrice(o);
        return (
          <li key={`${o.group_id}-${o.option_id}`} className={cn('text-neutral-500', compact ? 'text-[10px]' : 'text-xs')}>
            {o.option_name}
            {price > 0 && (
              <span className="text-neutral-700">
                {' '}
                +<Price value={price} size="sm" />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
