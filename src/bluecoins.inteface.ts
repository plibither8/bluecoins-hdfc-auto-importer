export interface Transaction {
  transactionsTableID: number;
  itemID: number;
  amount: number;
  transactionCurrency: string;
  conversionRateNew: number;
  date: string;
  transactionTypeID: number;
  categoryID: number;
  accountID: number;
  notes: string;
  status: number;
  accountReference: number;
  accountPairID: number;
  uidPairID: number;
  deletedTransaction: number;
  newSplitTransactionID: number;
  transferGroupID: number;
  hasPhoto: number;
  labelCount: number;
  reminderTransaction: number;
  reminderGroupID: number;
  reminderFrequency: number;
  reminderRepeatEvery: number;
  reminderEndingType: number;
  reminderStartDate: string;
  reminderEndDate: string;
  reminderAfterNoOfOccurences: number;
  reminderAutomaticLogTransaction: number;
  reminderRepeating: number;
  reminderRepeatByDayOfMonth: number;
  reminderExcludeWeekend: number;
  reminderWeekDayMoveSetting: number;
  reminderUnbilled: number;
  creditCardInstallment: number;
  reminderVersion: number;
  dataExtraColumnString1: string;
}

export interface Item {
  itemTableID: number;
  itemName: string;
  itemAutoFillVisibility: number;
}

export type TrackerData = [
  { txn: string },
  { tracking_id: string },
  { timestamp: string }
];
