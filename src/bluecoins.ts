import { ITEMTABLE as Item, PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import Fuse from "fuse.js";
import type { TrackerData } from "./bluecoins.interface";
import constants from "./constants";
import type { Transaction as HdfcTransaction } from "./hdfc.interface";

const prisma = new PrismaClient();

async function getOrCreateItem(transaction: HdfcTransaction): Promise<{
  item: Item;
  amount: number;
  currency: string;
  conversionRateNew: number;
}> {
  let { description } = transaction;
  let amount = (transaction.deposit || -transaction.withdrawal) * 1000000;
  let currency = "INR";
  let conversionRateNew = 1;

  const refiners: {
    condition: (str: string) => boolean;
    refiner: (str: string) => string;
  }[] = [
    {
      condition: (str) => str.startsWith("UPI-"),
      refiner: (str) => str.split("-")[1],
    },
    {
      condition: (str) => str.startsWith("POS "),
      refiner: (str) => str.split(" ").slice(2).join(" "),
    },
    {
      condition: (str) => str.startsWith("NEFT Cr-"),
      refiner: (str) => str.split("-")[2],
    },
    {
      condition: (str) => str.startsWith("INW "),
      refiner: (str) => {
        currency = "USD";
        [amount, conversionRateNew] = str
          .split(" ")[2]
          .substring(3)
          .split("@")
          .map(Number);
        amount *= 1000000;
        return "Pabio";
      },
    },
    {
      condition: (str) => str.includes("GST"),
      refiner: (str) => "Transfer Fee",
    },
    {
      condition: (str) => /^\d+-/.test(str),
      refiner: (str) => str.split("-").slice(1).join(" "),
    },
  ];

  const applicableRefiner = refiners.find((refiner) =>
    refiner.condition(description)
  );
  if (applicableRefiner) description = applicableRefiner.refiner(description);

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
  const results = fuse.search<Item>(description);
  const bestMatch = results[0];
  if (bestMatch?.score < 0.75)
    return {
      item: bestMatch.item,
      amount,
      currency,
      conversionRateNew,
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
      itemName: description,
      itemAutoFillVisibility: 0,
    },
  });
  return { item, amount, currency, conversionRateNew };
}

export async function addTransaction(
  transaction: HdfcTransaction,
  accountId: number
) {
  console.log("Getting or creating item");
  const { item, amount, currency, conversionRateNew } = await getOrCreateItem(
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
      amount,
      transactionCurrency: currency,
      conversionRateNew,
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
