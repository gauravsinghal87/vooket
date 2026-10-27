<?php

namespace App\Http\Requests\API\Admin;

use App\Models\IntegrationSetting;
use App\Services\Integration\IntegrationConfigResolver;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateIntegrationSettingRequest extends FormRequest
{
    protected $stopOnFirstFailure = false;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $service = $this->route('service');
        $def = app(IntegrationConfigResolver::class)->definition($service);

        $allowedProviders = array_values($def['allowed_providers'] ?? ['mock']);

        $rules = [
            'provider' => ['sometimes', 'string', 'in:'.implode(',', $allowedProviders)],
            'environment' => ['sometimes', 'string', 'in:test,live'],
            'is_enabled' => ['sometimes', 'boolean'],
            'settings' => ['sometimes', 'array'],
            'settings.map_id' => ['sometimes', 'nullable', 'string', 'max:120'],
            'settings.default_zoom' => ['sometimes', 'integer', 'min:1', 'max:20'],
            'settings.default_center' => ['sometimes', 'array'],
            'settings.default_center.latitude' => ['sometimes', 'numeric', 'between:-90,90'],
            'settings.default_center.longitude' => ['sometimes', 'numeric', 'between:-180,180'],
        ];

        // SMTP declares typed fields (port is an integer, encryption is an
        // enum), so it cannot use the generic "nullable string" credential rule.
        if ($service === 'smtp') {
            return array_merge($rules, $this->smtpRules());
        }

        foreach (array_keys($def['env_map'] ?? []) as $key) {
            $rules[$key] = ['sometimes', 'nullable', 'string', 'max:2048'];
        }

        return $rules;
    }

    /**
     * SMTP specific type rules.
     *
     * "Required when enabled" is intentionally NOT expressed with the `required`
     * rule: every field is optional (`sometimes`) so a partial save keeps the
     * stored value, and Laravel skips `required` for an absent `sometimes` key.
     * That cross-field check lives in withValidator() instead, where the
     * effective (stored + submitted) value is available.
     *
     * @return array<string, array<int, mixed>>
     */
    protected function smtpRules(): array
    {
        return [
            'host' => ['sometimes', 'nullable', 'string', 'max:255'],
            'port' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:65535'],
            'encryption' => ['sometimes', 'nullable', 'string', 'in:tls,ssl,none'],
            'username' => ['sometimes', 'nullable', 'string', 'max:255'],
            'password' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'from_email' => ['sometimes', 'nullable', 'email:rfc', 'max:255'],
            'from_name' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($this->route('service') !== 'smtp') {
                return;
            }

            if (filter_var($this->input('is_enabled'), FILTER_VALIDATE_BOOL)) {
                foreach (['host', 'port', 'from_email', 'from_name'] as $key) {
                    if ($this->effectiveSmtpValue($key) === null) {
                        $validator->errors()->add(
                            $key,
                            ucfirst(str_replace('_', ' ', $key)).' is required when SMTP is enabled.'
                        );
                    }
                }
            }

            // A username without any password cannot authenticate, and there is
            // no stored secret to fall back on.
            if ($this->effectiveSmtpValue('username') !== null
                && $this->effectiveSmtpValue('password') === null) {
                $validator->errors()->add('password', 'SMTP password is required when an SMTP username is set.');
            }
        });
    }

    /**
     * Resolve a field to the value that would actually be stored: the submitted
     * value when present, otherwise the currently persisted one.
     */
    protected function effectiveSmtpValue(string $key): ?string
    {
        if ($this->filled($key) && trim((string) $this->input($key)) !== '****') {
            $value = trim((string) $this->input($key));

            return $value === '' ? null : $value;
        }

        return $this->existingSmtpCredential($key);
    }

    /**
     * Read the currently stored (encrypted) credential so a blank submission can
     * be told apart from a first-time configuration.
     */
    protected function existingSmtpCredential(string $key): ?string
    {
        $value = IntegrationSetting::query()
            ->where('service', 'smtp')
            ->first()?->credentials[$key] ?? null;

        return is_string($value) && trim($value) !== '' ? $value : null;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'is_enabled' => filter_var($this->input('is_enabled', '1'), FILTER_VALIDATE_BOOL),
        ]);
    }
}
