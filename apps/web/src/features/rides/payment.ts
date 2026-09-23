import type { PaymentMethod, PaymentStatus } from './types';

export const paymentLabel = (method: PaymentMethod, status: PaymentStatus | null) => {
  if (!status) return method === 'CASH' ? 'Cash' : 'TeslaPay';
  if (status === 'PENDING') return 'Cash due (TeslaPay short)';
  return method === 'CASH' ? 'Paid in cash' : 'Paid via TeslaPay';
};
