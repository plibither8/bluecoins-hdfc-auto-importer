import type { ElementHandle } from "puppeteer";

export type State = Record<string, string>;

export type PptrElement = ElementHandle<Element>;

export interface Config {
  customerId: string;
  password: string;
  headless: boolean;
  secureAccess: boolean;
  accounts: string[];
}

export interface Transaction {
  id: string;
  description: string;
  date: Date;
  valueDate: Date;
  withdrawal: number;
  deposit: number;
  closingBalance: number;
}

export interface TransactionData {
  transaction: Transaction;
  accountName: string;
  accountId: number;
}
