<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\URL;

class SupportTicketAttachment extends Model
{
    use HasFactory;

    protected $appends = ['url'];

    protected $fillable = [
        'support_ticket_id',
        'user_id',
        'disk',
        'path',
        'original_name',
        'mime_type',
        'size',
    ];

    public function ticket()
    {
        return $this->belongsTo(SupportTicket::class, 'support_ticket_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function getUrlAttribute(): ?string
    {
        try {
            return URL::temporarySignedRoute('support.attachment.file', now()->addMinutes(60), ['attachmentId' => $this->id]);
        } catch (\Throwable $e) {
            return null;
        }
    }
}
