import type { WalletRepository } from '../interfaces';
import { apiClient } from '@/lib/apiClient';
import type { Wallet, WalletTransaction } from '@/types/catalog';
import type { Paginated } from '@/types/api';

export class ApiWalletRepository implements WalletRepository {
  async getWallet(): Promise<Wallet> {
    return apiClient.get<Wallet>(`/wallet`);
  }

  async getTransactions(): Promise<WalletTransaction[]> {
    const result = await apiClient.get<Paginated<WalletTransaction> | WalletTransaction[]>(`/wallet/transactions`);
    if (Array.isArray(result)) return result;
    return result?.data ?? [];
  }

  async topup(amount: number): Promise<{ wallet?: Wallet; transaction?: WalletTransaction }> {
    return apiClient.post<{ wallet?: Wallet; transaction?: WalletTransaction }>(`/wallet/topup`, { amount });
  }

  async verifyTopup(payload: unknown): Promise<{ balance: string }> {
    const result = await apiClient.post<{ wallet?: { balance?: string | number } }>(`/wallet/verify-payment`, payload);
    return { balance: result.wallet?.balance != null ? String(result.wallet.balance) : '0' };
  }
}