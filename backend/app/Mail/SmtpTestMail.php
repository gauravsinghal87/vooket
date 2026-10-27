<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Administrator-triggered SMTP delivery check. Carries no credentials and no
 * customer data.
 */
class SmtpTestMail extends Mailable
{
    use Queueable;

    public function __construct(
        public string $recipient,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            // Must be an array: Envelope normalizes with a Collection, and
            // passing a bare Address object would be cast to that object's own
            // properties and inject a null recipient.
            to: [new Address($this->recipient)],
            subject: 'SMTP Test Email',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.smtp-test',
            with: [
                'recipient' => $this->recipient,
                'appName' => config('app.name'),
            ],
        );
    }
}
