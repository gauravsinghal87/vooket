<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_templates', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->string('type', 20)->default('transactional'); // transactional|promotional|system
            $table->string('channel', 20)->default('all'); // push|sms|email|in_app|all
            $table->text('title_template')->nullable();
            $table->text('body_template')->nullable();
            $table->text('sms_template')->nullable();
            $table->text('email_subject_template')->nullable();
            $table->longText('email_body_template')->nullable();
            $table->json('variables')->nullable();
            $table->boolean('is_active')->default(true);
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('body');
            $table->string('type', 30)->default('general'); // order|ride|payment|wallet|promo|system|support
            $table->string('channel', 20)->default('in_app'); // in_app|push|sms|email
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->json('data')->nullable();
            $table->string('image')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['user_id', 'is_read']);
            $table->index(['reference_type', 'reference_id']);
        });

        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('ticket_type', 30); // order|payment|refund|ride|driver|delivery|vendor|wallet|account|technical
            $table->string('subject');
            $table->text('description');
            $table->string('priority', 10)->default('normal'); // low|normal|high|urgent
            $table->string('status', 20)->default('open'); // open|pending|resolved|closed|escalated
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('reference_type')->nullable();
            $table->timestamp('due_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->index(['status', 'priority']);
            $table->index(['user_id', 'status']);
        });

        Schema::create('support_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->text('message');
            $table->json('attachments')->nullable();
            $table->boolean('is_internal')->default(false);
            $table->boolean('is_from_customer')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('role')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->string('action');
            $table->string('entity_type');
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->text('description')->nullable();
            $table->string('level', 20)->default('info');
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['entity_type', 'entity_id']);
            $table->index(['user_id', 'created_at']);
            $table->index('action');
        });

        Schema::create('app_settings', function (Blueprint $table) {
            $table->id();
            $table->string('group', 50); // general|payment|maps|delivery|ride|promotion|notification|security|wallet|commission
            $table->string('key')->unique();
            $table->string('label');
            $table->text('value')->nullable();
            $table->string('type', 20)->default('string'); // string|number|boolean|json|array
            $table->boolean('is_public')->default(false);
            $table->json('options')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->index('group');
        });

        Schema::create('feature_flags', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('enabled')->default(true);
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('banners', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('subtitle')->nullable();
            $table->string('image');
            $table->string('position', 30)->default('home'); // home|food|grocery|rides|promo
            $table->unsignedBigInteger('target_id')->nullable();
            $table->string('target_type', 20)->nullable(); // restaurant|store|product|category|url
            $table->string('target_url')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('cms_pages', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->longText('content');
            $table->string('type', 20)->default('static'); // static|faq|help|policy
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('reviewable_type');
            $table->unsignedBigInteger('reviewable_id');
            $table->unsignedBigInteger('order_id')->nullable();
            $table->decimal('rating', 2, 1);
            $table->text('comment')->nullable();
            $table->json('images')->nullable();
            $table->string('status', 20)->default('published'); // published|pending|hidden|reported
            $table->integer('helpful_count')->default(0);
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->index(['reviewable_type', 'reviewable_id']);
            $table->index(['user_id', 'status']);
            $table->unique(['user_id', 'reviewable_type', 'reviewable_id', 'order_id']);
        });

        Schema::create('webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider');
            $table->string('event_type');
            $table->json('payload');
            $table->string('signature')->nullable();
            $table->string('status', 20)->default('received'); // received|processing|processed|failed|retrying
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamp('processed_at')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['provider', 'status']);
            $table->index('created_at');
        });

        Schema::create('dispatch_logs', function (Blueprint $table) {
            $table->id();
            $table->string('dispatch_type', 20); // delivery|ride
            $table->unsignedBigInteger('order_id')->nullable();
            $table->unsignedBigInteger('ride_id')->nullable();
            $table->unsignedBigInteger('candidate_id')->nullable();
            $table->string('candidate_type', 20)->nullable(); // driver|delivery_partner
            $table->decimal('distance_km', 8, 2)->nullable();
            $table->string('status', 20); // sent|accepted|rejected|expired|assigned
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['dispatch_type', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispatch_logs');
        Schema::dropIfExists('webhook_events');
        Schema::dropIfExists('reviews');
        Schema::dropIfExists('cms_pages');
        Schema::dropIfExists('banners');
        Schema::dropIfExists('feature_flags');
        Schema::dropIfExists('app_settings');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('support_messages');
        Schema::dropIfExists('support_tickets');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('notification_templates');
    }
};
