<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\Driver;
use App\Models\DriverEarning;
use App\Models\Ride;
use App\Models\User;
use App\Models\VehicleType;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\RideService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RideCommissionSettingTest extends TestCase
{
    use RefreshDatabase;

    private ?VehicleType $vehicleTypeInstance = null;

    protected function setUp(): void
    {
        parent::setUp();

        AppSetting::create([
            'group' => 'commission',
            'key' => 'ride_commission',
            'label' => 'Ride Commission %',
            'value' => '15',
            'type' => 'number',
        ]);
    }

    public function test_completed_ride_uses_admin_ride_commission_for_earning_and_commission(): void
    {
        $earning = $this->finalizeRideAtRate('15', 79);

        $earning->refresh();

        $this->assertSame(79.0, (float) $earning->trip_fare);
        $this->assertSame(15.0, (float) $earning->commission_percentage);
        $this->assertSame(85.0, (float) $earning->driver_percentage);
        $this->assertSame(11.85, (float) $earning->commission_amount);
        $this->assertSame(67.15, (float) $earning->earning_amount);
        $this->assertSame('app_settings', $earning->meta['commission_source']);
        $this->assertSame('ride_commission', $earning->meta['commission_key']);
    }

    public function test_completed_ride_credits_driver_wallet_and_earnings_with_driver_share(): void
    {
        $earning = $this->finalizeRideAtRate('15', 79);

        $driverUser = $earning->driver->user;

        $wallet = Wallet::where('user_id', $driverUser->id)->where('wallet_type', 'driver')->firstOrFail();
        $this->assertSame(67.15, (float) $wallet->balance);
        $this->assertSame(67.15, (float) $wallet->total_credited);

        $transaction = WalletTransaction::where('wallet_id', $wallet->id)
            ->where('type', 'EARNING')
            ->where('direction', 'credit')
            ->firstOrFail();
        $this->assertSame(67.15, (float) $transaction->amount);
        $this->assertSame(DriverEarning::class, $transaction->reference_type);
        $this->assertSame($earning->id, $transaction->reference_id);
    }

    public function test_driver_earning_total_reflects_commission_adjusted_amount(): void
    {
        $earning = $this->finalizeRideAtRate('15', 79);

        $this->assertSame(67.15, (float) DriverEarning::where('driver_id', $earning->driver_id)->sum('earning_amount'));
    }

    public function test_ride_finalization_at_20_percent_uses_80_percent_driver_share(): void
    {
        $earning = $this->finalizeRideAtRate('20', 100);

        $this->assertSame(20.0, (float) $earning->commission_percentage);
        $this->assertSame(20.0, (float) $earning->commission_amount);
        $this->assertSame(80.0, (float) $earning->earning_amount);
        $this->assertSame(80.0, (float) $earning->driver->user->wallets->firstWhere('wallet_type', 'driver')->balance);
    }

    public function test_ride_finalization_at_10_percent_uses_90_percent_driver_share(): void
    {
        $earning = $this->finalizeRideAtRate('10', 79);

        $this->assertSame(10.0, (float) $earning->commission_percentage);
        $this->assertSame(7.9, (float) $earning->commission_amount);
        $this->assertSame(71.1, (float) $earning->earning_amount);
    }

    public function test_historical_ride_snapshot_survives_later_setting_change(): void
    {
        AppSetting::where('key', 'ride_commission')->update(['value' => '20']);

        $historical = $this->finalizeRideAtRate('15', 79);
        $new = $this->finalizeRideAtRate('20', 100);

        $this->assertSame(15.0, (float) $historical->fresh()->commission_percentage);
        $this->assertSame(11.85, (float) $historical->fresh()->commission_amount);
        $this->assertSame(67.15, (float) $historical->fresh()->earning_amount);

        $this->assertSame(20.0, (float) $new->commission_percentage);
        $this->assertSame(20.0, (float) $new->commission_amount);
        $this->assertSame(80.0, (float) $new->earning_amount);
    }

    public function test_repeat_finalization_creates_single_earning_and_single_wallet_credit(): void
    {
        $ride = $this->inProgressRide(79);
        $earned = $this->service()->completeRide($ride);

        $this->service()->completeRide(Ride::find($ride->id));

        $earnings = DriverEarning::where('ride_id', $ride->id)->get();
        $this->assertCount(1, $earnings);

        $wallet = Wallet::where('user_id', $ride->driver->user_id)->where('wallet_type', 'driver')->firstOrFail();
        $this->assertSame(1, WalletTransaction::where('wallet_id', $wallet->id)->where('type', 'EARNING')->where('direction', 'credit')->count());
        $this->assertSame(1, DriverEarning::where('ride_id', $ride->id)->where('id', $earned->id)->count());
    }

    public function test_food_and_grocery_commission_settings_are_not_altered_by_ride_commission(): void
    {
        AppSetting::updateOrCreate(['key' => 'food_commission'], ['group' => 'commission', 'label' => 'Food Commission %', 'value' => '15', 'type' => 'number']);
        AppSetting::updateOrCreate(['key' => 'grocery_commission'], ['group' => 'commission', 'label' => 'Grocery Commission %', 'value' => '10', 'type' => 'number']);

        AppSetting::where('key', 'ride_commission')->update(['value' => '20']);

        $this->assertSame('15', AppSetting::where('key', 'food_commission')->value('value'));
        $this->assertSame('10', AppSetting::where('key', 'grocery_commission')->value('value'));
        $this->assertSame('20', AppSetting::where('key', 'ride_commission')->value('value'));
    }

    /**
     * Complete a fresh ride whose fare is split by the given ride_commission.
     */
    private function finalizeRideAtRate(string $rate, float $fare): DriverEarning
    {
        AppSetting::where('key', 'ride_commission')->update(['value' => $rate]);

        $ride = $this->inProgressRide($fare);

        $this->service()->completeRide($ride);

        return DriverEarning::where('ride_id', $ride->id)->firstOrFail();
    }

    private function inProgressRide(float $fare): Ride
    {
        $customer = User::factory()->create(['user_type' => 'customer']);
        $driverUser = User::factory()->create(['user_type' => 'driver']);
        $vehicleType = $this->vehicleType();

        $driver = Driver::create([
            'user_id' => $driverUser->id,
            'vehicle_type_id' => $vehicleType->id,
            'status' => 'approved',
            'is_online' => true,
            'is_busy' => false,
            'is_verified' => true,
            'vehicle_number' => 'RJ14PD1234',
            'vehicle_model' => 'Honda Activa',
            'license_number' => 'RJ14201801234',
            'license_expiry' => now()->addYears(3),
        ]);

        return Ride::create([
            'ride_number' => 'RIDE_TEST_'.md5(uniqid((string) $fare, true)),
            'user_id' => $customer->id,
            'driver_id' => $driver->id,
            'vehicle_type_id' => $vehicleType->id,
            'status' => Ride::STATUS_IN_PROGRESS,
            'pickup_address' => 'World Trade Park, Jaipur',
            'pickup_latitude' => 26.8540,
            'pickup_longitude' => 75.8053,
            'destination_address' => 'Shipra Path, Jaipur',
            'destination_latitude' => 26.8670,
            'destination_longitude' => 75.7700,
            'distance_km' => 3.78,
            'duration_min' => 8,
            'estimated_fare' => $fare,
            'final_fare' => $fare,
            'payment_method' => 'online',
            'payment_status' => Ride::PAYMENT_STATUS_PAID,
            'otp_verified' => true,
            'otp_verified_at' => now(),
        ]);
    }

    private function vehicleType(): VehicleType
    {
        if ($this->vehicleTypeInstance === null) {
            $this->vehicleTypeInstance = VehicleType::create(['name' => 'Bike', 'code' => 'bike', 'is_active' => true]);
        }

        return $this->vehicleTypeInstance;
    }

    private function service(): RideService
    {
        return app(RideService::class);
    }
}
