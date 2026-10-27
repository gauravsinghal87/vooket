<?php

namespace App\Services\Mail;

use RuntimeException;

/**
 * Raised when the admin-managed SMTP transport is unusable. The message is
 * always safe to show an administrator; the underlying transport error is kept
 * as `previous` and logged separately without credentials.
 */
class MailConfigurationException extends RuntimeException {}
