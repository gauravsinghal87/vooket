<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SMTP test email</title>
</head>
<body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px;">
        <tr>
            <td>
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">SMTP Test Email</h1>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
                    Your SMTP configuration is working correctly.
                </p>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
                    Outbound email is confirmed working for <strong>{{ $appName }}</strong>.
                </p>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
                    Sent to: <strong>{{ $recipient }}</strong>
                </p>
                <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
                    If you did not trigger this test from the admin integrations page, you can safely ignore this email.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
