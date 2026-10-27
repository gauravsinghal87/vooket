<?php

namespace App\Services;

use App\Models\Product;
use App\Models\VariationOption;

/**
 * Product option groups ("variation_options" + "variation_option_values").
 *
 * Pricing model (the single, documented model used across cart, checkout and
 * order creation):
 *
 *  - SIMPLE product: line price = product base price.
 *  - VARIABLE product:
 *      * The first SINGLE-select group (lowest sort_order) that has a selected
 *        option with a non-zero price REPLACES the base price with that option's
 *        price (Pattern B — "Sabji Full ₹180"). Groups without a priced option
 *        selected contribute nothing, so the base price is kept.
 *      * Every selected option of every MULTIPLE-select group ADDS its price on
 *        top (Pattern A — "Pizza Large ₹399 + Extra Cheese ₹40 + Olives ₹25").
 *        MULTIPLE additions are applied regardless of how the group sorts
 *        relative to the SINGLE replacement group.
 *
 * Option prices are always read from the database. Values sent by customer-web
 * are only used to identify which options were selected.
 */
class ProductOptionService
{
    public const SELECTION_TYPE_SINGLE = 'SINGLE';

    public const SELECTION_TYPE_MULTIPLE = 'MULTIPLE';

    /**
     * Validate and normalize the option-group payload sent by vendor-web.
     *
     * @param  array<int, array<string, mixed>>  $groups
     * @return array<int, array<string, mixed>> normalized groups
     *
     * @throws \InvalidArgumentException
     */
    public function validateAndNormalizeGroups(array $groups): array
    {
        if ($groups === []) {
            throw new \InvalidArgumentException('A variable product needs at least one option group.');
        }

        $normalized = [];
        $seenNames = [];

        foreach (array_values($groups) as $index => $group) {
            $name = trim((string) ($group['name'] ?? ''));
            if ($name === '' || mb_strlen($name) > 100) {
                throw new \InvalidArgumentException('Every option group needs a name (max 100 characters).');
            }

            if (in_array(mb_strtolower($name), $seenNames, true)) {
                throw new \InvalidArgumentException('Option group names must be unique.');
            }
            $seenNames[] = mb_strtolower($name);

            $selectionType = strtoupper((string) ($group['selection_type'] ?? ($group['type'] ?? 'single')));
            if (! in_array($selectionType, [self::SELECTION_TYPE_SINGLE, self::SELECTION_TYPE_MULTIPLE], true)) {
                throw new \InvalidArgumentException("Option group \"{$name}\" has an invalid selection type.");
            }

            $isRequired = (bool) ($group['is_required'] ?? $group['required'] ?? false);
            $minSelect = max(0, (int) ($group['min_select'] ?? 0));
            $maxSelect = (int) ($group['max_select'] ?? 0);

            if ($selectionType === self::SELECTION_TYPE_SINGLE) {
                $maxSelect = 1;
                $minSelect = min($minSelect, 1);
            } else {
                if ($maxSelect !== 0 && $maxSelect < $minSelect) {
                    throw new \InvalidArgumentException("Option group \"{$name}\": maximum selections must be >= minimum selections.");
                }
                if ($maxSelect < 1) {
                    throw new \InvalidArgumentException("Option group \"{$name}\": maximum selections must be at least 1.");
                }
            }

            $isRequired = $isRequired || $minSelect >= 1;
            if ($isRequired && $minSelect < 1) {
                $minSelect = 1;
            }

            $options = [];
            $seenOptionNames = [];
            foreach (array_values($group['options'] ?? $group['values'] ?? []) as $optionIndex => $option) {
                $optionName = trim((string) ($option['name'] ?? ''));
                if ($optionName === '' || mb_strlen($optionName) > 100) {
                    throw new \InvalidArgumentException("Every option in \"{$name}\" needs a name (max 100 characters).");
                }
                if (in_array(mb_strtolower($optionName), $seenOptionNames, true)) {
                    throw new \InvalidArgumentException("Options in \"{$name}\" must have unique names.");
                }
                $seenOptionNames[] = mb_strtolower($optionName);

                $price = (float) ($option['price'] ?? $option['price_adjustment'] ?? 0);
                if ($price < 0) {
                    throw new \InvalidArgumentException("Option \"{$optionName}\" in \"{$name}\" cannot have a negative price.");
                }

                $options[] = [
                    'id' => isset($option['id']) && $option['id'] !== null && $option['id'] !== '' ? (int) $option['id'] : null,
                    'name' => $optionName,
                    'price_adjustment' => round($price, 2),
                    'is_available' => (bool) ($option['is_available'] ?? true),
                    'sort_order' => (int) ($option['sort_order'] ?? $optionIndex + 1),
                ];
            }

            if ($options === []) {
                throw new \InvalidArgumentException("Option group \"{$name}\" needs at least one option.");
            }

            if (count($options) < $minSelect) {
                throw new \InvalidArgumentException("Option group \"{$name}\" needs at least {$minSelect} option(s).");
            }

            $normalized[] = [
                'id' => isset($group['id']) && $group['id'] !== null && $group['id'] !== '' ? (int) $group['id'] : null,
                'name' => $name,
                'selection_type' => $selectionType,
                'is_required' => $isRequired,
                'is_multi_select' => $selectionType === self::SELECTION_TYPE_MULTIPLE,
                'min_select' => $minSelect,
                'max_select' => $maxSelect,
                'is_active' => (bool) ($group['is_active'] ?? true),
                'sort_order' => (int) ($group['sort_order'] ?? $index + 1),
                'options' => $options,
            ];
        }

        return $normalized;
    }

    /**
     * Persist the option groups for a product (create/update/delete).
     *
     * @param  array<int, array<string, mixed>>  $groups  normalized groups
     */
    public function syncOptionGroups(Product $product, array $groups): void
    {
        if ($groups === []) {
            $product->variationOptions()->delete();
            $product->update(['product_type' => 'simple']);

            return;
        }

        $existingGroups = VariationOption::where('product_id', $product->id)->get()->keyBy('id');
        $incomingGroupIds = [];

        foreach ($groups as $group) {
            $payload = [
                'name' => $group['name'],
                'type' => $group['is_multi_select'] ? 'checkbox' : 'radio',
                'is_required' => $group['is_required'],
                'is_multi_select' => $group['is_multi_select'],
                'min_select' => $group['min_select'],
                'max_select' => $group['max_select'],
                'is_active' => $group['is_active'],
                'sort_order' => $group['sort_order'],
            ];

            if ($group['id'] && $existingGroups->has($group['id'])) {
                $variationOption = $existingGroups->get($group['id']);
                $variationOption->update($payload);
            } else {
                $variationOption = $product->variationOptions()->create($payload);
            }

            $incomingGroupIds[] = $variationOption->id;

            $existingValues = $variationOption->values()->get()->keyBy('id');
            $incomingValueIds = [];

            foreach ($group['options'] as $option) {
                $optionPayload = [
                    'name' => $option['name'],
                    'price_adjustment' => $option['price_adjustment'],
                    'is_available' => $option['is_available'],
                    'sort_order' => $option['sort_order'],
                ];

                if ($option['id'] && $existingValues->has($option['id'])) {
                    $existingValues->get($option['id'])->update($optionPayload);
                    $incomingValueIds[] = $option['id'];
                } else {
                    $incomingValueIds[] = $variationOption->values()->create($optionPayload)->id;
                }
            }

            $existingValues->whereNotIn('id', $incomingValueIds)->each->delete();
        }

        $existingGroups->whereNotIn('id', $incomingGroupIds)->each->delete();

        $product->update(['product_type' => 'variable']);
    }

    /**
     * Normalize raw customer submitted selections to a canonical list.
     *
     * @param  array<int, array<string, mixed>>|null  $selections
     * @return array<int, array{group_id: int, option_id: int}>
     */
    public function normalizeSelections(?array $selections): array
    {
        $selections = $selections ?? [];
        $normalized = [];

        foreach ($selections as $selection) {
            if (! is_array($selection)) {
                continue;
            }

            $groupId = isset($selection['group_id']) ? (int) $selection['group_id'] : null;
            $optionId = isset($selection['option_id']) ? (int) $selection['option_id'] : null;

            if ($groupId === null || $optionId === null) {
                continue;
            }

            $normalized[] = ['group_id' => $groupId, 'option_id' => $optionId];
        }

        return $normalized;
    }

    /**
     * Validate a selection against the product's live option configuration.
     *
     * @param  array<int, array{group_id: int, option_id: int}>  $selections
     * @return array<int, array{group_id: int, option_id: int}> validated selections
     *
     * @throws \InvalidArgumentException
     */
    public function validateSelections(Product $product, array $selections): array
    {
        $product->loadMissing(['variationOptions.values']);

        $groups = $product->variationOptions->keyBy('id');

        $byGroup = [];
        foreach ($selections as $selection) {
            $groupId = (int) ($selection['group_id'] ?? 0);
            $optionId = (int) ($selection['option_id'] ?? 0);

            $group = $groups->get($groupId);
            if (! $group) {
                throw new \InvalidArgumentException('One or more selected options are no longer available.');
            }

            $option = $group->values->firstWhere('id', $optionId);
            if (! $option || ! $option->is_available) {
                throw new \InvalidArgumentException('One or more selected options are no longer available.');
            }

            if ($group->is_multi_select) {
                if (! in_array($optionId, $byGroup[$groupId] ?? [], true)) {
                    $byGroup[$groupId][] = $optionId;
                }
            } else {
                // Single select: last submitted option for the group wins.
                $byGroup[$groupId] = [$optionId];
            }
        }

        foreach ($groups as $group) {
            if (! $group->is_active) {
                if (! empty($byGroup[$group->id] ?? [])) {
                    throw new \InvalidArgumentException('One or more selected options are no longer available.');
                }

                continue;
            }

            $count = count($byGroup[$group->id] ?? []);

            if ($group->is_required && $count === 0) {
                throw new \InvalidArgumentException("Please select \"{$group->name}\".");
            }

            if ($count < (int) $group->min_select) {
                throw new \InvalidArgumentException("Please select at least {$group->min_select} option(s) for \"{$group->name}\".");
            }

            if ($group->is_multi_select && (int) $group->max_select > 0 && $count > (int) $group->max_select) {
                throw new \InvalidArgumentException("You can select at most {$group->max_select} option(s) for \"{$group->name}\".");
            }
        }

        $validated = [];
        foreach ($byGroup as $groupId => $optionIds) {
            foreach ($optionIds as $optionId) {
                $validated[] = ['group_id' => $groupId, 'option_id' => $optionId];
            }
        }

        return $validated;
    }

    /**
     * Resolve the authoritative unit price for a product + selection.
     *
     * @param  array<int, array{group_id: int, option_id: int}>  $selections
     */
    public function resolveUnitPrice(Product $product, array $selections): float
    {
        $product->loadMissing(['variationOptions.values']);

        $base = (float) $product->price;
        $groups = $product->variationOptions
            ->where('is_active', true)
            ->sortBy('sort_order')
            ->values();

        $selected = [];
        foreach ($selections as $selection) {
            $selected[$selection['group_id'] ?? 0][] = $selection['option_id'];
        }

        $unit = $base;
        $addOnTotal = 0.0;
        $priceDefined = false;

        foreach ($groups as $group) {
            $optionIds = $selected[$group->id] ?? [];
            if ($optionIds === []) {
                continue;
            }

            $groupOptions = $group->values->whereIn('id', $optionIds)->where('is_available', true);

            if ($group->is_multi_select) {
                // Pattern A: every selected option of a MULTIPLE group adds its
                // price on top, regardless of how it sorts relative to SINGLE groups.
                foreach ($groupOptions as $option) {
                    $addOnTotal += (float) $option->price_adjustment;
                }
            } else {
                // Pattern B: the first SINGLE group (lowest sort_order) with a
                // priced option selected replaces the base price only. The
                // replacement must not clobber MULTIPLE add-on prices, which are
                // accumulated separately above.
                if (! $priceDefined) {
                    $pricedOption = $groupOptions->first(fn ($o) => (float) $o->price_adjustment > 0);
                    if ($pricedOption) {
                        $unit = (float) $pricedOption->price_adjustment;
                        $priceDefined = true;
                    }
                }
            }
        }

        return round(max(0, $unit + $addOnTotal), 2);
    }

    /**
     * Build the enriched, snapshot-ready selection structure with prices.
     *
     * @param  array<int, array{group_id: int, option_id: int}>  $selections
     * @return array<int, array<string, mixed>>
     */
    public function enrichSelections(Product $product, array $selections): array
    {
        $product->loadMissing(['variationOptions.values']);

        $groups = $product->variationOptions->keyBy('id');
        $enriched = [];

        foreach ($selections as $selection) {
            $group = $groups->get($selection['group_id'] ?? 0);
            $option = $group?->values->firstWhere('id', $selection['option_id'] ?? 0);

            if (! $group || ! $option) {
                continue;
            }

            $enriched[] = [
                'group_id' => $group->id,
                'group_name' => $group->name,
                'selection_type' => $group->is_multi_select
                    ? self::SELECTION_TYPE_MULTIPLE
                    : self::SELECTION_TYPE_SINGLE,
                'option_id' => $option->id,
                'option_name' => $option->name,
                'price' => (float) $option->price_adjustment,
            ];
        }

        return $enriched;
    }

    /**
     * Deterministic identity for a cart line: product + exact selection set.
     *
     * @param  array<int, array{group_id: int, option_id: int}>  $selections
     */
    public function selectionSignature(array $selections): string
    {
        $canonical = array_map(
            fn ($s) => ['group_id' => (int) $s['group_id'], 'option_id' => (int) $s['option_id']],
            $selections
        );

        usort($canonical, fn ($a, $b) => $a['group_id'] <=> $b['group_id'] ?: $a['option_id'] <=> $b['option_id']);

        return md5(json_encode($canonical));
    }
}
