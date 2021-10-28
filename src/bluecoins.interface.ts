import type { TRANSACTIONSTABLE as Transaction } from "@prisma/client";

export type TrackerData = [
  { txn: string },
  { tracking_id: string },
  { timestamp: string }
];

export interface RefinedOutput {
  itemName: string;
  overrideTransactionDetails?: Partial<Transaction>;
}
