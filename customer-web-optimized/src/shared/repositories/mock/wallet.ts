import type { WalletRepository } from '../interfaces';
import type { Wallet, WalletTransaction } from '@/shared/types/catalog';
import { mockState } from './mockState';

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

export class MockWalletRepository implements WalletRepository {
  async getWallet(): Promise<Wallet> {
    await delay(200);
    return {
      id: 1,
      user_id: 1,
      wallet_type: 'customer',
      balance: mockState.walletBalance.toFixed(2),
      pending_balance: '0.00',
      total_credited: '3500.00',
      total_debited: '1000.00',
      currency: 'INR',
      status: 'active',
    };
  }

  async getTransactions(): Promise<WalletTransaction[]> {
    await delay(300);
    const seeds = [
      { type: 'CREDIT', amount: 1000, desc: 'Money added to wallet', days: 2, dir: 'credit' },
      { type: 'DEBIT', amount: 268, desc: 'Payment for ride RD-1001', days: 2, dir: 'debit' },
      { type: 'BONUS', amount: 50, desc: 'Referral reward', days: 6, dir: 'credit' },
      { type: 'CREDIT', amount: 2500, desc: 'Money added to wallet', days: 9, dir: 'credit' },
      { type: 'REFUND', amount: 120, desc: 'Refund for cancelled order', days: 11, dir: 'credit' },
    ] as const;
    const list: WalletTransaction[] = seeds.map((s, i) => {
      const t = new Date(Date.now() - s.days * 86400000).toISOString();
      return {
        id: i + 1,
        transaction_id: `TXN-${1000 + i}`,
        wallet_id: 1,
        type: s.type,
        amount: s.amount.toFixed(2),
        balance_before: '0.00',
        balance_after: s.amount.toFixed(2),
        currency: 'INR',
        direction: s.dir,
        status: 'completed',
        reference_type: null,
        reference_id: null,
        description: s.desc,
        created_at: t,
      };
    });
    return [...list, ...mockState.walletTransactions];
  }

  async topup(amount: number) {
    await delay(500);
    mockState.walletBalance += amount;
    mockState.walletTransactions.unshift({
      id: Date.now(),
      transaction_id: `TXN-${Date.now()}`,
      wallet_id: 1,
      type: 'TOP_UP',
      amount: amount.toFixed(2),
      balance_before: (mockState.walletBalance - amount).toFixed(2),
      balance_after: mockState.walletBalance.toFixed(2),
      currency: 'INR',
      direction: 'credit',
      status: 'completed',
      reference_type: null,
      reference_id: null,
      description: `Money added to wallet`,
      created_at: new Date().toISOString(),
    });
    return {
      wallet: {
        id: 1,
        user_id: 1,
        wallet_type: 'customer',
        balance: mockState.walletBalance.toFixed(2),
        pending_balance: '0.00',
        total_credited: '4500.00',
        total_debited: '1000.00',
        currency: 'INR',
        status: 'active',
      } satisfies Wallet,
      transaction: undefined,
    };
  }

  async verifyTopup() {
    await delay(300);
    return { balance: mockState.walletBalance.toFixed(2) };
  }
}
