export {};

declare global {
  type TerminalStatus = {
    online: boolean;
    lockState: 'unlocked' | 'locked';
    leaseExpiresAt?: number | null;
    shopId?: string;
    shopName?: string;
  };

  interface Window {
    electronAPI?: {
      saveOfflineSale?: (sale: unknown) => Promise<{ success: boolean; id: string }>;
      getOfflineSaleCount?: () => Promise<number>;
      syncOfflineSales?: (config?: { idToken?: string }) => Promise<{ synced: number }>;
      redeemActivationToken?: (token: string) => Promise<{ success: boolean; shopName?: string; message?: string }>;
      getTerminalStatus?: () => Promise<TerminalStatus>;
    };
  }
}
