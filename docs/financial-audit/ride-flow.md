# Ride Financial Flow

## 1. Fare estimate

- Route: `POST /api/rides/estimate` (or via RideController) -> `RideService::estimateFare(data)`.
- Distance/duration from maps provider (Google if configured) else haversine; `distanceBetween`.
- FareRule selected by vehicle_type_id and is_active (first match). Fare formula in `FareCalculationService::calculate`:
  - distanceCharge = distanceKm * per_km (rounded)
  - timeCharge = durationMin * per_minute (rounded)
  - subtotal = base_fare + distanceCharge + timeCharge + booking_fee + platform_fee
  - tax = subtotal * tax_rate / 100
  - estimated_fare = round(subtotal + tax, 2), min minimum_fare.
- Returns estimated_fare, breakdown, vehicle_type, distance, duration, fare_rule_id.

## 2. Ride creation

- Route `POST /api/rides` -> `RideController::store` -> `RideService::createRide(user,data)`.
- Idempotency key + fingerprint. Zone serviceability check. Estimate fare. Creates Ride status REQUESTING, stores fare components, estimated_fare, payment_method (default cash), OTP. Dispatches to drivers. `is_scheduled` if scheduled_at.

## 3. Accept/start/complete

- Driver accepts via dispatch. Ride status DRIVER_ASSIGNED -> ARRIVING -> ARRIVED -> (start) IN_PROGRESS -> COMPLETED.
- OTP verified at start (`otp_verified`).
- Complete: `RideService::completeRide` row-locks ride. If status already COMPLETED returns. Requires IN_PROGRESS, driver, otp_verified.
- Final fare: if route.source='live', recomputes via `finalFareFromLiveRoute` using fare rule base/per_km/per_minute/booking/platform fees + waiting + tip - discount + tax, min minimum_fare. Else final_fare = final_fare ?? estimated_fare.
- Wallet payment method: debits customer wallet finalFare (idempotency `ride:{id}`); on failure payment_status FAILED. Then `isPaymentSettled()` must be true else throws (ride not completed). Sets payment_status PAID.
- DriverEarning: `DriverEarning::updateOrCreate(ride_id)` with trip_fare=finalFare, driver_percentage=100-commissionRate, commission_percentage=commissionRate, commission_amount, earning_amount=finalFare-commission. Status PENDING (note: never transitions to paid? payout?).
- Credits driver wallet via `WalletService::creditEarning` idempotent by earning id, service=ride. Driver earning status stays pending but wallet credited immediately.
- Commission rate from AppSetting group=commission key=ride_commission (live). If missing -> 0 (no commission). Commission not stored in commissions table for rides (only driver_earnings). Platform revenue? Not recorded separately.

## 4. Payment methods

- cash (default), wallet, online. Payment initiation via PaymentService supports Ride payable (total = final_fare/estimated_fare). On capture syncs payment_status.
- Cash rides: driver collects cash (`confirmCashCollection`), sets cash_collected, payment_status=PAID, payment_method=cash. Then `settleCashCollection` debits driver wallet by collected amount (SETTLEMENT idempotent `ride-cash-settlement:{ride_number}`) and sets cash_settled. Completion requires cash_settled if cash_collected.

## 5. Cancellation

- `RideService::cancelRide`: if driver assigned and status in assigned/arriving/arrived, cancellation fee from FareRule.cancellation_fee (else 0) stored in meta.cancellation.fee. Does NOT debit customer or credit driver for fee in code inspected (fee only recorded). Sets CANCELLED. Releases driver is_busy. Driver rejected_rides incremented only on releaseAssignment, not cancel.
- No refund processing for rides found (no RefundService usage in RideService). Potential gap: online-paid cancelled ride not refunded automatically.

## 6. Driver earnings & payout

- DriverEarning status PENDING (no available/paid transition in inspected code). Driver payout availability (`WithdrawalService::requestDriverWithdrawal`) computes available = sum DriverEarning.earning_amount - sum Payouts PENDING/PROCESSING/SUCCESS. So pending earnings are treated available immediately. Payout request creates Payout PENDING. Admin mark paid debits driver wallet (idempotent `admin-payout-paid:{id}`) and sets SUCCESS. Driver minimum wallet floor? WithdrawalService uses partnerMinimumWalletBalance for driver too (same partner floor). 

## 7. Platform commission

- Only ride_commission setting percentage. No commission_rules usage for ride (CommissionService only orders). No commissions table row for rides. Platform revenue from rides not tracked in commissions.

## 8. Frontend

- Customer ride booking/payment. Driver wallet/earnings/withdrawals. Admin fare rules.
- Ride status history.
