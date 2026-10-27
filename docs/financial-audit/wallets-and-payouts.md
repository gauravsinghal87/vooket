# Wallets and Payouts

## 1. Wallet schema & balance

- `wallets`: balance (cached), pending_balance (reserved), total_credited, total_debited, currency, status active/frozen/closed, unique(user_id,wallet_type).
- `wallet_transactions`: CREDIT/DEBIT/REFUND/COMMISSION/PAYOUT/SETTLEMENT/BONUS/INCENTIVE/CASH_COLLECTION/ADJUSTMENT/REVERSAL/TOP_UP/PURCHASE/WITHDRAWAL; direction credit/debit; status pending/completed/failed/reversed; balance_before/after; idempotency_key (unique).
- `ledger_entries`: one row per wallet transaction, account_type debit/credit (opposing side), account_name wallet account. Not double-entry pairs (single row, no offsetting account row). So not true double-entry.

## 2. Balance semantics

- `WalletService::getBalance` returns raw `balance` (includes reserved? Actually pending is separate; balance not reduced by pending). Spendable = balance - pending (`available()`).
- `WalletService::credit` increases balance + total_credited, records tx completed, ledger entry (opposing account 'debit' for credit? recordLedger called with opposingAccount='debit' for credit transaction — odd naming).
- `WalletService::debit` checks balance >= amount, decreases balance, increases total_debited. Does not consider pending_balance (can overdraw reserved funds). 
- `creditEarning` idempotent by `wallet-earning:{service}:{class}:{id}`.
- `ensureWallet` firstOrCreate.

## 3. Withdrawal reservation

- `reserveForWithdrawal`: checks balance - pending >= amount, creates WalletTransaction status pending (WITHDRAWAL, direction debit), increases pending_balance. Does not reduce balance. Finalize reduces both balance and pending. Release reduces pending only.

## 4. Payout lifecycle

States: PENDING -> PROCESSING -> SUCCESS/FAILED; REVERSED maybe. Admin endpoints: processing/paid/failed.

- Driver withdrawal: available = sum DriverEarning.earning_amount - sum Payouts PENDING/PROCESSING/SUCCESS. Guard partner floor. Create payout PENDING. No wallet reservation. On admin paid: debit wallet idempotent `admin-payout-paid:{id}` (SETTLEMENT? actually debit type default DEBIT? call uses referenceType payout, no type param? defaults DEBIT) and SUCCESS. On failed: no release needed (no reservation) but status FAILED.
- Partner withdrawal: available = sum DeliveryPartnerEarning (not reversed) - sum payouts. Same.
- Vendor withdrawal: available = min(wallet available - vendor floor, settlement due - requested payouts). Locks settlements. On paid debits wallet. On failed no release.
- Wallet withdrawal: reserves wallet funds (pending), creates payout PENDING with meta wallet_transaction_id. On paid finalize reservation (balance+pending reduce). On failed release reservation.

## 5. Minimum balance floors

- Vendor floor from AppSetting group=vendor_payout key=vendor_min_wallet_balance (default config vendor_payout.min_wallet_balance). Partner floor group=partner_payout key=partner_min_wallet_balance. Read live.

## 6. Payout provider

- No real provider transfer performed; admin manually marks paid/failed. `gateway` field nullable but not used in markPayoutSuccess. Provider references only if supplied externally. Mode default bank_transfer. So payouts are manual accounting.

## 7. Concurrency/idempotency

- Payout idempotency_key unique. Existing payout lookup before balance checks. Row locks on subject profiles and earnings. But vendor available balance query locks settlements only if lock=true (called with true in request). Driver/partner available not locked at DB level? They use lockForUpdate on profile and earnings. Should be okay-ish but race on payouts table sum not locked (payouts not locked). Potential duplicate if concurrent requests with different idempotency keys.

## 8. Risks

- `wallets.balance` is cached mutable; if transactions inserted manually, balance can drift. No reconciliation job except reconcileFinalizedEarnings (credits missing earnings).
- `debit()` doesn't check pending_balance; spendable not protected on direct debits.
- `available()` uses ensureWallet (creates wallet) even for reads.
- Wallet transactions idempotency unique globally (not per wallet), so keys must be globally unique.
- Ledger entries single-sided, not true double-entry.
- Payout marking paid debits wallet once via idempotency key; re-run safe.
- Failed payouts for vendor/driver/partner do not adjust anything (no reservation) so no release needed; but availability still counts PENDING/PROCESSING/SUCCESS payouts, so failed payout should be excluded (it is, since status FAILED not in list). Good.
- markPayoutSuccess for wallet-funded uses transaction id from meta; if missing and party_type in vendor/driver/delivery_partner, debits wallet. For wallet party_type? It skips debit? Actually for wallet-funded payout, transactionId present, finalizeWithdrawal handles debit. Good.

## 9. Tests

- PartnerWalletBalanceFloorTest, VendorWalletBalanceFloorTest, PartnerWalletTest, WalletServiceTest, WalletTopupPaymentTest.
