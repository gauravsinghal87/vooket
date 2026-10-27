<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Food-only preparation instructions requested by the customer.
 *
 * These are customer preferences, not guaranteed restaurant services, and they
 * never affect pricing: nothing here is passed into subtotal, tax, delivery
 * fee or any total. Paid product options/add-ons remain a separate concern
 * stored on order_items.selected_options / selected_addons.
 *
 * Storage reuses the existing order metadata architecture rather than adding
 * duplicate columns:
 *   - order.meta.preparation_instructions
 *   - order_item.meta.preparation_instructions
 *
 * Each selected key is stored with a label snapshot so a historical order
 * still reads correctly if the label is ever reworded.
 */
class PreparationInstructionService
{
    /**
     * Server-approved instruction keys. This is the only source of truth for
     * what a customer may submit.
     *
     * @var array<string, array{label: string, emoji: string}>
     */
    public const CATALOG = [
        'make_spicy' => ['label' => 'Make it spicy', 'emoji' => '🌶️'],
        'less_spicy' => ['label' => 'Less spicy', 'emoji' => '🌶️'],
        'less_oil' => ['label' => 'Less oil', 'emoji' => '🫒'],
        'less_salt' => ['label' => 'Less salt', 'emoji' => '🧂'],
        'no_onion' => ['label' => 'No onion', 'emoji' => '🧅'],
        'no_garlic' => ['label' => 'No garlic', 'emoji' => '🧄'],
        'send_cutlery' => ['label' => 'Send cutlery', 'emoji' => '🍴'],
        'extra_sauce' => ['label' => 'Send extra sauce', 'emoji' => '🥫'],
        'extra_chutney' => ['label' => 'Send extra chutney', 'emoji' => '🥣'],
    ];

    public const META_KEY = 'preparation_instructions';

    public const MAX_NOTE_LENGTH = 500;

    /**
     * Canonical stored key for the restaurant-level note. Historically the same
     * value was written as `note`, so reads still fall back to that key.
     */
    public const NOTE_KEY = 'restaurant_note';

    /**
     * Explicit cutlery preference. `true` means cutlery is sent, which matches
     * the application default, so a customer who says nothing keeps today's
     * behaviour. `false` means "Don't send cutlery".
     */
    public const CUTLERY_KEY = 'send_cutlery';

    /**
     * The only preparation-instruction fields a customer may submit when
     * placing a food order. Anything else in the cart payload is rejected by
     * the controller, so no unsupported instruction key can ever be stored.
     *
     * @var array<int, string>
     */
    public const CART_FIELDS = [self::NOTE_KEY, self::CUTLERY_KEY];

    /**
     * Statuses where the restaurant has not started cooking yet, so the
     * customer may still amend the request. From PREPARING onwards the order
     * is read-only.
     *
     * @var string[]
     */
    public const EDITABLE_STATUSES = ['PENDING', 'PLACED', 'ACCEPTED', 'CONFIRMED'];

    /**
     * The offer shown to the customer for food orders.
     *
     * @return array<int, array{key: string, label: string, emoji: string}>
     */
    public function options(): array
    {
        $options = [];

        foreach (self::CATALOG as $key => $definition) {
            $options[] = [
                'key' => $key,
                'label' => $definition['label'],
                'emoji' => $definition['emoji'],
            ];
        }

        return $options;
    }

    /**
     * @return string[]
     */
    public function allowedKeys(): array
    {
        return array_keys(self::CATALOG);
    }

    public function supports(Order $order): bool
    {
        return $order->order_type === 'food';
    }

    public function canEdit(Order $order): bool
    {
        return $this->supports($order)
            && ! in_array(strtoupper((string) $order->status), ['CANCELLED', 'DELIVERED'], true)
            && in_array(strtoupper((string) $order->status), self::EDITABLE_STATUSES, true);
    }

    /**
     * Validate the customer payload. Throws ValidationException on failure so
     * the controller can return the project's standard 422 envelope.
     *
     * @param  array<int, string>  $selected
     */
    public function validate(array $selected, ?string $note): void
    {
        Validator::make(
            ['selected' => $selected, 'note' => $note],
            [
                'selected' => ['sometimes', 'array', 'max:'.count($this->allowedKeys())],
                'selected.*' => ['required', 'string', 'distinct', 'in:'.implode(',', $this->allowedKeys())],
                'note' => ['nullable', 'string', 'max:'.self::MAX_NOTE_LENGTH],
            ],
            [
                'selected.*.in' => 'The selected :attribute is not an approved preparation instruction.',
            ]
        )->validate();
    }

    /**
     * Validate the compact pre-order (cart) instruction payload.
     *
     * This is deliberately a separate, much smaller contract than the legacy
     * preset contract above: the customer-facing cart only offers a
     * restaurant-level note and a cutlery preference.
     *
     * @param  array<string, mixed>  $data
     */
    public function validateCartPayload(array $data): void
    {
        $unsupported = array_values(array_diff(array_keys($data), self::CART_FIELDS));

        if ($unsupported !== []) {
            throw ValidationException::withMessages([
                'preparation_instructions' => 'Unsupported preparation instruction field: '.implode(', ', $unsupported),
            ]);
        }

        Validator::make($data, [
            self::NOTE_KEY => ['nullable', 'string', 'max:'.self::MAX_NOTE_LENGTH],
            self::CUTLERY_KEY => ['nullable', 'boolean'],
        ])->validate();
    }

    /**
     * Build the stored snapshot for a food order being placed from the cart.
     *
     * Returned as a ready-to-store meta fragment so the caller can merge it
     * into the order's existing meta inside the same transaction that creates
     * the order, rather than writing the order twice.
     *
     * @param  array<string, mixed>  $data
     * @return array{selected: array<int, array{key: string, label: string, emoji: string}>, restaurant_note: string|null, send_cutlery: bool, updated_at: string}
     */
    public function buildCartSnapshot(array $data): array
    {
        $this->validateCartPayload($data);

        $rawNote = $data[self::NOTE_KEY] ?? null;
        $note = $this->sanitizeNote(is_string($rawNote) ? $rawNote : null);

        // The customer is only offered "Don't send cutlery", so anything other
        // than an explicit false keeps the existing application default.
        $rawCutlery = $data[self::CUTLERY_KEY] ?? null;
        $sendCutlery = ! ($rawCutlery === false || $rawCutlery === 0 || $rawCutlery === '0' || $rawCutlery === 'false');

        return [
            'selected' => [],
            self::NOTE_KEY => $note,
            self::CUTLERY_KEY => $sendCutlery,
            'updated_at' => now()->toISOString(),
        ];
    }

    /**
     * Normalise validated input into the stored snapshot shape, keeping the
     * label alongside the key.
     *
     * @param  array<int, string>  $selected
     * @return array{selected: array<int, array{key: string, label: string, emoji: string}>, restaurant_note: string|null, send_cutlery: bool|null, updated_at: string}
     */
    public function normalize(array $selected, ?string $note): array
    {
        $normalized = [];

        foreach ($selected as $key) {
            $key = is_string($key) ? trim($key) : '';

            if (! isset(self::CATALOG[$key]) || isset($normalized[$key])) {
                continue;
            }

            $normalized[$key] = [
                'key' => $key,
                'label' => self::CATALOG[$key]['label'],
                'emoji' => self::CATALOG[$key]['emoji'],
            ];
        }

        return [
            'selected' => array_values($normalized),
            self::NOTE_KEY => $this->sanitizeNote($note),
            'updated_at' => now()->toISOString(),
        ];
    }

    /**
     * Strip markup and control characters so the note is stored as plain text.
     */
    public function sanitizeNote(?string $note): ?string
    {
        if ($note === null) {
            return null;
        }

        $clean = strip_tags($note);
        $clean = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $clean) ?? '';
        $clean = trim($clean);

        if ($clean === '') {
            return null;
        }

        return mb_substr($clean, 0, self::MAX_NOTE_LENGTH);
    }

    /**
     * Persist order-level and optional item-level instructions.
     *
     * @param  array<int, string>  $selected
     * @param  array<int, array{order_item_id: int, selected: array<int, string>, note: string|null}>|null  $items
     */
    public function write(Order $order, array $selected, ?string $note, ?array $items = null): Order
    {
        $snapshot = $this->normalize($selected, $note);

        $meta = $this->metaArray($order->meta);
        $meta[self::META_KEY] = $snapshot;
        $order->update(['meta' => $meta]);

        if ($items !== null) {
            $this->writeItems($order, $items);
        }

        return $order->refresh();
    }

    /**
     * @param  array<int, array{order_item_id: int, selected: array<int, string>, note: string|null}>  $items
     */
    private function writeItems(Order $order, array $items): void
    {
        $orderItemIds = array_values(array_filter(array_map(
            fn (array $item) => isset($item['order_item_id']) ? (int) $item['order_item_id'] : null,
            $items
        )));

        if ($orderItemIds === []) {
            return;
        }

        // Scoped to the order so a customer can never write to another order's item.
        $orderItems = OrderItem::where('order_id', $order->id)
            ->whereIn('id', $orderItemIds)
            ->get()
            ->keyBy('id');

        foreach ($items as $item) {
            $orderItemId = (int) ($item['order_item_id'] ?? 0);
            $orderItem = $orderItems->get($orderItemId);

            if (! $orderItem) {
                continue;
            }

            $itemMeta = $this->metaArray($orderItem->meta);
            $itemMeta[self::META_KEY] = $this->normalize(
                is_array($item['selected'] ?? null) ? $item['selected'] : [],
                $item['note'] ?? null
            );
            $orderItem->update(['meta' => $itemMeta]);
        }
    }

    /**
     * Order-level instructions currently stored, in the read shape the APIs
     * expose.
     *
     * @return array{selected: array<int, array{key: string, label: string, emoji: string}>, note: string|null, restaurant_note: string|null, send_cutlery: bool|null, updated_at: string|null}
     */
    public function read(Order $order): array
    {
        $stored = $this->metaArray($order->meta)[self::META_KEY] ?? null;

        return $this->present(is_array($stored) ? $stored : []);
    }

    /**
     * @return array<int, array{order_item_id: int, selected: array<int, array{key: string, label: string, emoji: string}>, note: string|null, restaurant_note: string|null, send_cutlery: bool|null, updated_at: string|null}>
     */
    public function readItems(Order $order): array
    {
        $result = [];

        foreach ($order->items as $item) {
            $stored = $this->metaArray($item->meta)[self::META_KEY] ?? null;
            $result[] = [
                'order_item_id' => $item->id,
                ...$this->present(is_array($stored) ? $stored : []),
            ];
        }

        return $result;
    }

    /**
     * Full payload for the customer endpoint: server-approved options plus the
     * stored instructions and whether they may still be changed.
     *
     * @return array<string, mixed>
     */
    public function payload(Order $order): array
    {
        return [
            'service' => $order->order_type,
            'options' => $this->options(),
            'editable' => $this->canEdit($order),
            'editable_statuses' => self::EDITABLE_STATUSES,
            'max_note_length' => self::MAX_NOTE_LENGTH,
            'instructions' => $this->read($order),
            'items' => $this->readItems($order),
        ];
    }

    public function hasAny(Order $order): bool
    {
        if ($this->read($order)['selected'] !== [] || $this->read($order)['note'] !== null) {
            return true;
        }

        foreach ($this->readItems($order) as $item) {
            if ($item['selected'] !== [] || $item['note'] !== null) {
                return true;
            }
        }

        return false;
    }

    /**
     * Defensive meta read, matching the existing DeliveryService convention.
     *
     * @return array<string, mixed>
     */
    private function metaArray(mixed $meta): array
    {
        return is_array($meta) ? $meta : (is_string($meta) ? (json_decode($meta, true) ?: []) : []);
    }

    /**
     * @param  array<string, mixed>  $stored
     * @return array{selected: array<int, array{key: string, label: string, emoji: string}>, note: string|null, restaurant_note: string|null, send_cutlery: bool|null, updated_at: string|null}
     */
    private function present(array $stored): array
    {
        $selected = [];

        foreach (is_array($stored['selected'] ?? null) ? $stored['selected'] : [] as $entry) {
            if (is_string($entry)) {
                $entry = ['key' => $entry];
            }

            if (! is_array($entry) || ! isset($entry['key'])) {
                continue;
            }

            $key = (string) $entry['key'];
            $definition = self::CATALOG[$key] ?? null;

            $selected[] = [
                'key' => $key,
                // Prefer the stored label snapshot so historical orders keep
                // their original wording.
                'label' => isset($entry['label']) && $entry['label'] !== ''
                    ? (string) $entry['label']
                    : ($definition['label'] ?? $key),
                'emoji' => isset($entry['emoji']) && $entry['emoji'] !== ''
                    ? (string) $entry['emoji']
                    : ($definition['emoji'] ?? ''),
            ];
        }

        // `restaurant_note` is canonical; `note` is the historical key.
        $note = match (true) {
            isset($stored[self::NOTE_KEY]) => $stored[self::NOTE_KEY] !== '' ? (string) $stored[self::NOTE_KEY] : null,
            isset($stored['note']) => $stored['note'] !== '' ? (string) $stored['note'] : null,
            default => null,
        };

        // Legacy orders recorded "send cutlery" as a selected preset. Anything
        // else is unknown rather than explicitly true, so the vendor view stays
        // quiet instead of printing a meaningless default.
        $sendCutlery = match (true) {
            array_key_exists(self::CUTLERY_KEY, $stored) => (bool) $stored[self::CUTLERY_KEY],
            in_array(self::CUTLERY_KEY, array_column($selected, 'key'), true) => true,
            default => null,
        };

        return [
            'selected' => $selected,
            'note' => $note,
            self::NOTE_KEY => $note,
            self::CUTLERY_KEY => $sendCutlery,
            'updated_at' => $stored['updated_at'] ?? null,
        ];
    }
}
