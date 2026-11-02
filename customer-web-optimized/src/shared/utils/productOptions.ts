import type { OptionGroup, Product, ProductOption } from '@/shared/types/catalog';
import type { SelectedOption } from '@/shared/types/models';
import { formatCurrency } from '@/shared/utils/utils';

function toNumber(raw: string | number | null | undefined): number {
  const n = typeof raw === 'string' ? parseFloat(raw) : raw;
  return Number.isFinite(n) ? (n as number) : 0;
}

export function optionPrice(value: ProductOption): number {
  return toNumber(value.price ?? value.price_adjustment);
}

export function optionAvailable(value: ProductOption): boolean {
  return value.is_available ?? value.is_active ?? true;
}

export function groupIsActive(group: OptionGroup): boolean {
  return group.is_active ?? true;
}

export function groupIsSingle(group: OptionGroup): boolean {
  if (group.is_multi_select != null) return !group.is_multi_select;
  return (group.selection_type ?? 'SINGLE') === 'SINGLE';
}

export function activeOptionGroups(product: Product): OptionGroup[] {
  return (product.variation_options ?? [])
    .filter(groupIsActive)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export function hasActiveOptionGroups(product: Product): boolean {
  return activeOptionGroups(product).length > 0;
}

export function needsOptionSelection(product: Product): boolean {
  return hasActiveOptionGroups(product);
}

export function groupMinSelect(group: OptionGroup): number {
  const min = group.is_required ? Math.max(1, group.min_select ?? 0) : (group.min_select ?? 0);
  return groupIsSingle(group) ? Math.min(min, 1) : min;
}

export function groupMaxSelect(group: OptionGroup): number {
  const fallback = Math.max(1, (group.values ?? []).length);
  const max = group.max_select ?? fallback;
  return groupIsSingle(group) ? 1 : Math.max(1, max);
}

export function defaultSelections(group: OptionGroup): number[] {
  const values = (group.values ?? []).filter(optionAvailable);
  const defaults = values.filter((v) => v.is_default === true).map((v) => v.id);

  if (groupIsSingle(group)) {
    return defaults.length > 0 ? [defaults[0]] : values.length > 0 ? [values[0].id] : [];
  }

  const max = groupMaxSelect(group);
  const min = groupMinSelect(group);
  const chosen = defaults.slice(0, max);
  const want = Math.max(min, chosen.length);

  for (const v of values) {
    if (chosen.length >= want) break;
    if (!chosen.includes(v.id)) chosen.push(v.id);
  }

  return chosen.slice(0, max);
}

export function unitPricePreview(product: Product, selected: Record<number, number[]>): number {
  let unit = toNumber(product.price);
  let addOnTotal = 0;
  let priceDefined = false;

  for (const group of activeOptionGroups(product)) {
    const ids = selected[group.id] ?? [];
    if (ids.length === 0) continue;

    const values = ids
      .map((id) => (group.values ?? []).find((v) => v.id === id))
      .filter((v): v is ProductOption => !!v && optionAvailable(v));

    if (groupIsSingle(group)) {
      if (!priceDefined) {
        const priced = values.find((v) => optionPrice(v) > 0);
        if (priced) {
          unit = optionPrice(priced);
          priceDefined = true;
        }
      }
    } else {
      for (const v of values) addOnTotal += optionPrice(v);
    }
  }

  return Math.max(0, Math.round((unit + addOnTotal) * 100) / 100);
}

export function selectedOptionPrice(sel: SelectedOption): number {
  return toNumber(sel.price ?? sel.option_price);
}

export function optionPriceLabel(value: ProductOption): string | null {
  const price = optionPrice(value);
  return price > 0 ? `+${formatCurrency(price)}` : null;
}