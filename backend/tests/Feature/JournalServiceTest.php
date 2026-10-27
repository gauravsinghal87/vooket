<?php

namespace Tests\Feature;

use App\Models\JournalEntry;
use App\Models\JournalLine;
use App\Services\JournalService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class JournalServiceTest extends TestCase
{
    use RefreshDatabase;

    private JournalService $journal;

    protected function setUp(): void
    {
        parent::setUp();

        $this->journal = app(JournalService::class);
    }

    public function test_post_creates_a_balanced_entry_with_every_line(): void
    {
        $entry = $this->journal->post(
            sourceType: 'Payment',
            sourceId: 1,
            entryType: 'payment_captured',
            lines: [
                ['account' => 'payment_clearing', 'direction' => 'debit', 'amount' => 100],
                ['account' => 'order_revenue_clearing', 'direction' => 'credit', 'amount' => 100],
            ],
            description: 'Capture'
        );

        $this->assertSame(2, $entry->lines()->count());
        $this->assertEqualsWithDelta(100.0, (float) $entry->total_debit, 0.01);
        $this->assertEqualsWithDelta(100.0, (float) $entry->total_credit, 0.01);
        $this->assertTrue($entry->isBalanced());
        $this->assertNotNull($entry->entry_number);
        $this->assertNotNull($entry->posted_at);
    }

    public function test_post_rejects_an_unbalanced_entry(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Unbalanced journal entry');

        $this->journal->post('Payment', 1, 'payment_captured', [
            ['account' => 'payment_clearing', 'direction' => 'debit', 'amount' => 100],
            ['account' => 'order_revenue_clearing', 'direction' => 'credit', 'amount' => 90],
        ]);
    }

    public function test_post_rejects_a_single_sided_entry(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('at least two lines');

        $this->journal->post('Payment', 1, 'payment_captured', [
            ['account' => 'payment_clearing', 'direction' => 'debit', 'amount' => 100],
        ]);
    }

    public function test_post_rejects_an_unknown_account(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Unknown journal account');

        $this->journal->post('Payment', 1, 'payment_captured', [
            ['account' => 'mystery_account', 'direction' => 'debit', 'amount' => 100],
            ['account' => 'order_revenue_clearing', 'direction' => 'credit', 'amount' => 100],
        ]);
    }

    public function test_post_rejects_zero_and_negative_amounts(): void
    {
        foreach ([0, -5] as $amount) {
            try {
                $this->journal->post('Payment', 1, 'payment_captured', [
                    ['account' => 'payment_clearing', 'direction' => 'debit', 'amount' => $amount],
                    ['account' => 'order_revenue_clearing', 'direction' => 'credit', 'amount' => $amount],
                ]);

                $this->fail("Amount {$amount} should have been rejected");
            } catch (RuntimeException $e) {
                $this->assertStringContainsString('must be positive', $e->getMessage());
            }
        }

        $this->assertSame(0, JournalEntry::count());
    }

    public function test_post_is_idempotent_by_idempotency_key(): void
    {
        $lines = [
            ['account' => 'payment_clearing', 'direction' => 'debit', 'amount' => 50],
            ['account' => 'order_revenue_clearing', 'direction' => 'credit', 'amount' => 50],
        ];

        $first = $this->journal->post('Payment', 1, 'payment_captured', $lines, 'key-1');
        $second = $this->journal->post('Payment', 1, 'payment_captured', $lines, 'key-1');

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, JournalEntry::count());
        $this->assertSame(2, JournalLine::count());
    }

    public function test_reverse_mirrors_every_line_and_leaves_the_original_intact(): void
    {
        $lines = [
            ['account' => 'payment_clearing', 'direction' => 'debit', 'amount' => 75],
            ['account' => 'order_revenue_clearing', 'direction' => 'credit', 'amount' => 75],
        ];

        $original = $this->journal->post('Payment', 1, 'payment_captured', $lines, 'capture-1');
        $reversal = $this->journal->reverse('Payment', 1, 'payment_captured', $lines, 'capture-1');

        $this->assertSame('payment_captured_reversal', $reversal->entry_type);
        $this->assertNotSame($original->id, $reversal->id);
        $this->assertTrue($reversal->isBalanced());

        $originalLines = $original->lines()->orderBy('id')->get();
        $reversalLines = $reversal->lines()->orderBy('id')->get();

        foreach ($originalLines as $index => $line) {
            $this->assertSame($line->account, $reversalLines[$index]->account);
            $this->assertNotSame($line->direction, $reversalLines[$index]->direction);
            $this->assertEqualsWithDelta((float) $line->amount, (float) $reversalLines[$index]->amount, 0.01);
        }

        // Original unchanged and no journal is unbalanced overall.
        $this->assertSame(2, JournalEntry::count());
        $this->assertTrue($this->journal->isBalanced());
    }

    public function test_balance_and_balances_report_net_position_per_account(): void
    {
        $this->journal->post('Payment', 1, 'payment_captured', [
            ['account' => 'payment_clearing', 'direction' => 'debit', 'amount' => 400],
            ['account' => 'order_revenue_clearing', 'direction' => 'credit', 'amount' => 400],
        ], 'cap-1');

        $this->journal->post('Order', 9, 'vendor_settlement', [
            ['account' => 'order_revenue_clearing', 'direction' => 'debit', 'amount' => 360],
            ['account' => 'vendor_wallet', 'direction' => 'credit', 'amount' => 360],
        ], 'settle-1');

        $paymentClearing = $this->journal->balance('payment_clearing');
        $this->assertEqualsWithDelta(400.0, (float) $paymentClearing->major(), 0.01);

        $revenue = $this->journal->balance('order_revenue_clearing');
        $this->assertEqualsWithDelta(-40.0, (float) $revenue->major(), 0.01);

        $balances = $this->journal->balances(['payment_clearing', 'order_revenue_clearing', 'vendor_wallet']);

        $this->assertEqualsWithDelta(400.0, $balances['payment_clearing']['net'], 0.01);
        $this->assertEqualsWithDelta(-40.0, $balances['order_revenue_clearing']['net'], 0.01);
        $this->assertEqualsWithDelta(-360.0, $balances['vendor_wallet']['net'], 0.01);
        $this->assertTrue($this->journal->isBalanced());
    }

    public function test_wallet_counterparty_mapping_covers_the_money_flows(): void
    {
        $map = fn (string $type, string $direction, ?string $ref = null, array $meta = []) => $this->journal
            ->walletCounterparty('customer', $type, $direction, $ref, $meta);

        // Gateway money in (top-up) and wallet payment for an order.
        $this->assertSame('payment_clearing', $map('TOP_UP', 'credit'));
        $this->assertSame('order_revenue_clearing', $map('DEBIT', 'debit', 'Order'));

        // Refunds of an order/ride give revenue back; top-up refunds return
        // gateway money.
        $this->assertSame('order_revenue_clearing', $map('REFUND', 'credit', 'Order'));
        $this->assertSame('ride_revenue_clearing', $map('REFUND', 'credit', 'Ride'));
        $this->assertSame('payment_clearing', $map('REFUND', 'credit', null));

        // Earnings are funded by the service's revenue; admin credits are
        // platform expense.
        $this->assertSame('order_revenue_clearing', $map('EARNING', 'credit', 'Order', ['service' => 'food']));
        $this->assertSame('ride_revenue_clearing', $map('EARNING', 'credit', 'Ride', ['service' => 'ride']));
        $this->assertSame('platform_expense', $map('BONUS', 'credit'));

        // Cash settlement clears the receivable of whoever collected it.
        $this->assertSame('partner_cash_receivable', app(JournalService::class)
            ->walletCounterparty('delivery_partner', 'SETTLEMENT', 'debit', 'Order'));
        $this->assertSame('driver_cash_receivable', app(JournalService::class)
            ->walletCounterparty('driver', 'SETTLEMENT', 'debit', 'Ride'));

        // Payouts leave through the gateway clearing account.
        $this->assertSame('payment_clearing', $map('WITHDRAWAL', 'debit'));
    }
}
