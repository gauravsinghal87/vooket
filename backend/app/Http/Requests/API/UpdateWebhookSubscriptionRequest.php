<?php

namespace App\Http\Requests\API;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateWebhookSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $allowed = array_keys(config('webhooks.events', []));

        return [
            'target_url' => ['sometimes', 'url', 'max:2048', 'starts_with:https://,http://localhost'],
            'events' => ['sometimes', 'array', 'min:1'],
            'events.*' => ['string', Rule::in(['*', ...$allowed])],
            'status' => ['sometimes', 'boolean'],
        ];
    }
}
