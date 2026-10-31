<?php

namespace Tests\Feature;

use App\Models\Banner;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BannerDiscoveryTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $role = Role::updateOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);
        $this->admin = User::create([
            'name' => 'Banner Admin',
            'email' => 'banner@example.com',
            'phone' => '9999999988',
            'password' => Hash::make('secret'),
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $this->admin->roles()->sync([$role->id]);
    }

    private function authHeaders(): array
    {
        return ['Authorization' => 'Bearer '.$this->admin->createToken('test')->plainTextToken];
    }

    private function makeBanner(array $overrides = []): Banner
    {
        return Banner::create(array_merge([
            'title' => 'Minimum',
            'subtitle' => '₹150 OFF',
            'cta_text' => 'Order now',
            'image' => 'https://example.com/banner.jpg',
            'media_type' => 'image',
            'position' => 'food',
            'service' => 'food',
            'placement' => 'food_home_hero',
            'target_type' => 'url',
            'target_url' => '/restaurants',
            'is_active' => true,
            'sort_order' => 1,
        ], $overrides));
    }

    public function test_public_endpoint_returns_active_food_home_hero_banners(): void
    {
        $this->makeBanner();

        $res = $this->getJson('/api/v1/banners?service=food&placement=food_home_hero');

        $res->assertOk()->assertJsonPath('success', true);
        $data = $res->json('data');
        $this->assertCount(1, $data);
        $this->assertSame('Minimum', $data[0]['title']);
        $this->assertSame('food_home_hero', $data[0]['placement']);
        $this->assertSame('image', $data[0]['media_type']);
        $this->assertSame('https://example.com/banner.jpg', $data[0]['media_url']);
        $this->assertArrayNotHasKey('updated_at', $data[0]);
    }

    public function test_expired_and_scheduled_banners_are_excluded(): void
    {
        $this->makeBanner(['title' => 'Live', 'expires_at' => now()->addDay()]);
        $this->makeBanner(['title' => 'Expired', 'expires_at' => now()->subDay()]);
        $this->makeBanner(['title' => 'Scheduled', 'starts_at' => now()->addDay()]);
        $this->makeBanner(['title' => 'Inactive', 'is_active' => false]);

        $data = $this->getJson('/api/v1/banners?service=food&placement=food_home_hero')
            ->assertOk()
            ->json('data');

        $this->assertSame(['Live'], collect($data)->pluck('title')->all());
    }

    public function test_home_endpoint_splits_banners_per_service(): void
    {
        $this->makeBanner(['title' => 'Food promo']);
        $this->makeBanner(['title' => 'Grocery promo', 'service' => 'grocery', 'placement' => 'grocery_home_hero']);

        $res = $this->getJson('/api/v1/discovery/home')->assertOk();

        $foodBanners = collect($res->json('data.food.banners'))->pluck('title')->all();
        $groceryBanners = collect($res->json('data.grocery.banners'))->pluck('title')->all();

        $this->assertSame(['Food promo'], $foodBanners);
        $this->assertSame(['Grocery promo'], $groceryBanners);
        $this->assertNotContains('Grocery promo', $foodBanners);
        $this->assertNotContains('Food promo', $groceryBanners);
        $this->assertArrayNotHasKey('banners', $res->json('data'));
    }

    public function test_admin_can_create_a_food_home_hero_banner_with_media_fields(): void
    {
        $res = $this->postJson('/api/v1/admin/banners', [
            'title' => 'Weekend Feast',
            'subtitle' => 'Flat ₹150 off',
            'cta_text' => 'Order now',
            'image' => 'https://example.com/banner.jpg',
            'video' => 'https://example.com/food-promo.mp4',
            'poster_image' => 'https://example.com/poster.jpg',
            'media_type' => 'video',
            'service' => 'food',
            'placement' => 'food_home_hero',
            'target_type' => 'restaurant',
            'target_id' => 1,
            'is_active' => true,
            'sort_order' => 2,
        ], $this->authHeaders());

        $res->assertCreated()->assertJsonPath('data.service', 'food')->assertJsonPath('data.placement', 'food_home_hero');

        $this->assertDatabaseHas('banners', [
            'title' => 'Weekend Feast',
            'media_type' => 'video',
            'service' => 'food',
            'placement' => 'food_home_hero',
        ]);
    }

    public function test_admin_can_upload_a_banner_video(): void
    {
        Storage::fake('public');

        $res = $this->postJson('/api/v1/admin/banners/upload-video', [
            'video' => UploadedFile::fake()->create('food-promo.mp4', 1000, 'video/mp4'),
        ], $this->authHeaders());

        $res->assertOk()->assertJsonPath('success', true);
        $video = $res->json('data.video');
        $this->assertNotEmpty($video);
        Storage::disk('public')->assertExists(str_replace(config('app.url').'/storage/', '', $video));
    }

    public function test_video_upload_rejects_non_video_files(): void
    {
        $res = $this->postJson('/api/v1/admin/banners/upload-video', [
            'video' => UploadedFile::fake()->image('banner.png'),
        ], $this->authHeaders());

        $res->assertStatus(422);
        $this->assertArrayHasKey('video', $res->json('errors'));
    }

    public function test_food_home_hero_stays_isolated_to_food(): void
    {
        $this->makeBanner(['title' => 'Food only', 'service' => 'food', 'placement' => 'food_home_hero']);

        $grocery = $this->getJson('/api/v1/banners?service=grocery&placement=grocery_home_hero')->json('data');

        $this->assertSame([], $grocery);

        $food = $this->getJson('/api/v1/banners?service=food&placement=food_home_hero')->json('data');
        $this->assertSame(['Food only'], collect($food)->pluck('title')->all());
    }

    public function test_admin_cannot_create_a_banner_with_a_removed_home_placement(): void
    {
        $res = $this->postJson('/api/v1/admin/banners', [
            'title' => 'Old home hero',
            'image' => 'https://example.com/banner.jpg',
            'service' => 'all',
            'placement' => 'home_hero',
            'is_active' => true,
        ], $this->authHeaders());

        $res->assertStatus(422);
        $this->assertArrayHasKey('placement', $res->json('errors'));
    }

    public function test_admin_can_target_a_banner_at_an_internal_route(): void
    {
        $res = $this->postJson('/api/v1/admin/banners', [
            'title' => 'Ride promo',
            'image' => 'https://example.com/banner.jpg',
            'service' => 'rides',
            'placement' => 'rides_home_hero',
            'target_type' => 'url',
            'target_url' => '/rides',
            'is_active' => true,
        ], $this->authHeaders());

        $res->assertCreated()->assertJsonPath('data.target_url', '/rides');

        $this->assertDatabaseHas('banners', [
            'title' => 'Ride promo',
            'target_type' => 'url',
            'target_url' => '/rides',
            'placement' => 'rides_home_hero',
        ]);
    }

    public function test_admin_can_create_and_target_a_rides_promotions_banner(): void
    {
        $res = $this->postJson('/api/v1/admin/banners', [
            'title' => 'Beat the traffic',
            'subtitle' => 'Bike Taxi',
            'image' => 'https://example.com/rides-promo.jpg',
            'service' => 'rides',
            'placement' => 'rides_promotions',
            'target_type' => 'url',
            'target_url' => '/rides',
            'is_active' => true,
            'sort_order' => 1,
        ], $this->authHeaders());

        $res->assertCreated()->assertJsonPath('data.placement', 'rides_promotions');

        $rides = $this->getJson('/api/v1/banners?service=rides&placement=rides_promotions')
            ->assertOk()
            ->json('data');
        $this->assertSame(['Beat the traffic'], collect($rides)->pluck('title')->all());

        // A rides-only promo never leaks into another service's placement.
        $food = $this->getJson('/api/v1/banners?service=food&placement=food_home_hero')->json('data');
        $this->assertSame([], $food);
    }

    public function test_admin_can_create_a_grocery_brand_promo_banner(): void
    {
        $res = $this->postJson('/api/v1/admin/banners', [
            'title' => 'Fresh Savings',
            'subtitle' => 'Up to 30% off staples',
            'image' => 'https://example.com/brand-promo.jpg',
            'service' => 'grocery',
            'placement' => 'grocery_home_brand_promo',
            'is_active' => true,
            'sort_order' => 1,
        ], $this->authHeaders());

        $res->assertCreated()->assertJsonPath('data.placement', 'grocery_home_brand_promo');

        $grocery = $this->getJson('/api/v1/banners?service=grocery&placement=grocery_home_brand_promo')
            ->assertOk()
            ->json('data');
        $this->assertSame(['Fresh Savings'], collect($grocery)->pluck('title')->all());

        // The grocery-only brand promo never leaks into another service's slot.
        $food = $this->getJson('/api/v1/banners?service=food&placement=food_home_hero')->json('data');
        $this->assertSame([], $food);
    }

    public function test_grocery_home_hero_returns_active_banners_in_admin_order_and_stays_isolated(): void
    {
        $this->makeBanner([
            'title' => 'Festive Diwali',
            'service' => 'grocery',
            'placement' => 'grocery_home_hero',
            'sort_order' => 0,
        ]);
        $this->makeBanner([
            'title' => 'Winter Store',
            'service' => 'grocery',
            'placement' => 'grocery_home_hero',
            'sort_order' => 1,
        ]);
        $this->makeBanner([
            'title' => 'Expired Hero',
            'service' => 'grocery',
            'placement' => 'grocery_home_hero',
            'sort_order' => 2,
            'expires_at' => now()->subDay(),
        ]);
        $this->makeBanner([
            'title' => 'Inactive Hero',
            'service' => 'grocery',
            'placement' => 'grocery_home_hero',
            'sort_order' => 3,
            'is_active' => false,
        ]);
        $this->makeBanner([
            'title' => 'Fresh Savings',
            'service' => 'grocery',
            'placement' => 'grocery_home_brand_promo',
            'sort_order' => 1,
        ]);
        $this->makeBanner(['title' => 'Food Hero', 'service' => 'food', 'placement' => 'food_home_hero']);

        $hero = $this->getJson('/api/v1/banners?service=grocery&placement=grocery_home_hero')
            ->assertOk()
            ->json('data');

        // Active grocery hero banners only, in the Admin's sort order.
        $this->assertSame(['Festive Diwali', 'Winter Store'], collect($hero)->pluck('title')->all());
        $this->assertCount(2, $hero);
        $this->assertSame(
            ['grocery_home_hero'],
            collect($hero)->pluck('placement')->unique()->values()->all()
        );

        // The brand-promo placement and the Food hero never leak into the hero.
        $this->assertNotContains('Fresh Savings', collect($hero)->pluck('title'));
        $this->assertNotContains('Food Hero', collect($hero)->pluck('title'));

        $promos = $this->getJson('/api/v1/banners?service=grocery&placement=grocery_home_brand_promo')
            ->assertOk()
            ->json('data');

        $this->assertSame(['Fresh Savings'], collect($promos)->pluck('title')->all());
    }

    public function test_admin_can_create_and_target_an_order_tracking_banner(): void
    {
        $res = $this->postJson('/api/v1/admin/banners', [
            'title' => 'Track & save',
            'subtitle' => 'Reorder in one tap',
            'image' => 'https://example.com/order-tracking.jpg',
            'service' => 'food',
            'placement' => 'order_tracking',
            'is_active' => true,
            'sort_order' => 1,
        ], $this->authHeaders());

        $res->assertCreated()->assertJsonPath('data.placement', 'order_tracking');

        $food = $this->getJson('/api/v1/banners?service=food&placement=order_tracking')
            ->assertOk()
            ->json('data');
        $this->assertSame(['Track & save'], collect($food)->pluck('title')->all());

        // A food-tracked promo never leaks into the grocery tracking carousel.
        $grocery = $this->getJson('/api/v1/banners?service=grocery&placement=order_tracking')->json('data');
        $this->assertSame([], $grocery);
    }

    public function test_order_tracking_banner_shared_with_all_services_renders_on_both(): void
    {
        $this->makeBanner([
            'title' => 'Everyone',
            'service' => 'all',
            'placement' => 'order_tracking',
        ]);
        $this->makeBanner([
            'title' => 'Grocery only',
            'service' => 'grocery',
            'placement' => 'order_tracking',
        ]);

        $food = collect($this->getJson('/api/v1/banners?service=food&placement=order_tracking')->json('data'))
            ->pluck('title')->all();
        $grocery = collect($this->getJson('/api/v1/banners?service=grocery&placement=order_tracking')->json('data'))
            ->pluck('title')->all();

        $this->assertSame(['Everyone'], $food);
        $this->assertSame(['Grocery only', 'Everyone'], $grocery);
    }

    public function test_order_tracking_placement_is_still_rejected_when_unknown(): void
    {
        $res = $this->postJson('/api/v1/admin/banners', [
            'title' => 'Bad placement',
            'image' => 'https://example.com/banner.jpg',
            'service' => 'food',
            'placement' => 'tracking',
            'is_active' => true,
        ], $this->authHeaders());

        $res->assertStatus(422);
        $this->assertArrayHasKey('placement', $res->json('errors'));
    }

    public function test_admin_can_list_banners_filtered_by_service_and_placement(): void
    {
        $this->makeBanner();
        $this->makeBanner(['title' => 'Other', 'service' => 'grocery', 'placement' => 'grocery_home_hero']);

        $res = $this->getJson('/api/v1/admin/banners?service=food&placement=food_home_hero', $this->authHeaders());

        $res->assertOk();
        $titles = collect($res->json('data'))->pluck('title')->all();
        $this->assertSame(['Minimum'], $titles);
    }
}
