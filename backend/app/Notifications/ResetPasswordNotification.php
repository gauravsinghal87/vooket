<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Password reset link for the customer SPA.
 *
 * Laravel's stock ResetPassword notification builds a URL for the `password.reset`
 * web route, which this API-only application does not serve. The link is
 * therefore built from the configured customer-web origin so the email always
 * opens the correct frontend in both local and production environments.
 */
class ResetPasswordNotification extends Notification
{
    /**
     * Create a new notification instance.
     *
     * The raw token is only ever held in memory for the lifetime of this
     * notification and is written to the database only in hashed form by
     * Laravel's database token repository.
     */
    public function __construct(
        #[\SensitiveParameter] public string $token,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = $this->resetUrl($notifiable);
        $expiry = (int) config('auth.passwords.users.expire', 60);

        return (new MailMessage)
            ->subject('Reset Your Password')
            ->greeting("Hello {$notifiable->name},")
            ->line('We received a request to reset the password for your account.')
            ->action('Reset Password', $url)
            ->line("This link will expire in {$expiry} minutes and can only be used once.")
            ->line('If you did not request a password reset, you can safely ignore this email.');
    }

    /**
     * Build the customer-web reset URL from server-side configuration.
     *
     * The origin is never derived from the incoming request, which prevents an
     * attacker from poisoning the link with their own host (no open redirect).
     */
    protected function resetUrl(object $notifiable): string
    {
        $base = rtrim((string) config('frontend.customer_web_url'), '/');

        return $base.'/auth/reset-password?'.http_build_query([
            'token' => $this->token,
            'email' => $notifiable->email,
        ]);
    }
}
