import {
  ITEMTABLE as Item,
  PrismaClient,
  TRANSACTIONSTABLE as Transaction,
} from "@prisma/client";
import fs from "fs/promises";
import Fuse from "fuse.js";
import type { TrackerData } from "./bluecoins.interface";
import constants from "./constants";
import type { Transaction as HdfcTransaction } from "./hdfc.interface";
import { getRefinedItemName } from "./refinery";

const prisma = new PrismaClient();

async function getOrCreateItem(transaction: HdfcTransaction): Promise<{
  item: Item;
  overrideTransactionDetails?: Partial<Transaction>;
}> {
  const { itemName, overrideTransactionDetails } =
    getRefinedItemName(transaction);

  // Get items from the database
  console.log("Getting items from the database");
  const items = await prisma.iTEMTABLE.findMany();

  // Search for a possible match
  const fuse = new Fuse(items, {
    keys: ["itemName"],
    includeScore: true,
    threshold: 0.7,
    minMatchCharLength: 3,
  });
  const results = fuse.search<Item>(itemName);
  const bestMatch = results[0];
  if (bestMatch?.score < 0.75)
    return {
      item: bestMatch.item,
      overrideTransactionDetails,
    };

  // Create a new item
  console.log("Creating a new item");
  const newId =
    items
      .map((item) => Number(item.itemTableID))
      .sort((a, b) => a - b)
      .pop() + 1;
  const item = await prisma.iTEMTABLE.create({
    data: {
      itemTableID: newId,
      itemName: transaction.description,
      itemAutoFillVisibility: 0,
    },
  });
  return {
    item,
    overrideTransactionDetails,
  };
}

export async function addTransaction(
  transaction: HdfcTransaction,
  accountId: number
) {
  console.log("Getting or creating item");
  const { item, overrideTransactionDetails } = await getOrCreateItem(
    transaction
  );

  const transactionId = Date.now();
  console.log("Getting previous transaction");
  const previousSimilarTransaction = await prisma.tRANSACTIONSTABLE.findFirst({
    where: {
      itemID: item.itemTableID,
      deletedTransaction: 6,
    },
  });
  const categoryID = previousSimilarTransaction?.categoryID || 0;

  // Add transaction to the database
  console.log("Adding transaction to the database");
  await prisma.tRANSACTIONSTABLE.create({
    data: {
      transactionsTableID: transactionId,
      itemID: item.itemTableID,
      amount: (transaction.deposit || -transaction.withdrawal) * 1000000,
      transactionCurrency: "INR",
      conversionRateNew: 1,
      date: transaction.date,
      transactionTypeID: transaction.deposit === 0 ? 3 : 4,
      categoryID,
      accountID: accountId,
      notes: transaction.description,
      status: 0,
      accountReference: 1,
      accountPairID: accountId,
      uidPairID: transactionId,
      deletedTransaction: 6,
      newSplitTransactionID: 0,
      transferGroupID: 0,
      ...overrideTransactionDetails,
    },
  });

  // Update tracker info
  console.log("Updating tracker file...");
  const file = await fs.readFile(constants.tracker.local, "utf8");
  const tracker = JSON.parse(file) as TrackerData;
  tracker[0].txn = (Number(tracker[0].txn) + 1).toString();
  tracker[1].tracking_id = transactionId.toString();
  tracker[2].timestamp = transactionId.toString();
  await fs.writeFile(constants.tracker.local, JSON.stringify(tracker));
}
