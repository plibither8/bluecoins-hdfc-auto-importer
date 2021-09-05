import type { Transaction, Item, TrackerData } from "./bluecoins.inteface";
import type { Transaction as HdfcTransaction } from "./hdfc.inteface";
import fs from "fs/promises";
import { Database } from "sqlite3";
import Fuse from "fuse.js";
import constants from "./constants";
import { bluecoinsDateFormat } from "./utils";

async function getOrCreateItem(
  db: Database,
  transaction: HdfcTransaction
): Promise<{
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
  ];

  const applicableRefiner = refiners.find((refiner) =>
    refiner.condition(description)
  );
  if (applicableRefiner) description = applicableRefiner.refiner(description);

  // Get items from the database
  console.log("Getting items from the database");
  const items = await new Promise<Item[]>((resolve, reject) => {
    db.all("SELECT * FROM ITEMTABLE", (err, rows) => {
      if (err) {
        console.error(err);
        reject(err);
      } else resolve(rows);
    });
  });

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
      .sort()
      .pop() + 1;
  const item = await new Promise<Item>((resolve, reject) => {
    db.run(
      `INSERT INTO ITEMTABLE (
        itemTableID,
        itemName,
        itemAutoFillVisibility
      ) VALUES (?, ?, ?)`,
      [newId, description, 0],
      (err) => {
        if (err) {
          console.error(err);
          reject(err);
        } else
          resolve({
            itemTableID: newId,
            itemName: description,
            itemAutoFillVisibility: 0,
          });
      }
    );
  });
  return { item, amount, currency, conversionRateNew };
}

export async function addTransaction(
  transaction: HdfcTransaction,
  accountId: number
) {
  const db = new Database(constants.database.local);
  console.log("Getting or creating item");
  const { item, amount, currency, conversionRateNew } = await getOrCreateItem(
    db,
    transaction
  );

  const transactionId = Date.now();
  console.log("Getting previous transaction");
  const previousSimilarTransaction = await new Promise<Transaction>(
    (resolve, reject) => {
      db.get(
        `
          SELECT * FROM TRANSACTIONSTABLE
          WHERE itemID = ? AND deletedTransaction = 6
          ORDER BY date DESC
          LIMIT 1
        `,
        [item.itemTableID],
        (err, row) => {
          if (err) {
            console.error(err);
            reject(err);
          } else resolve(row);
        }
      );
    }
  );
  const categoryID = previousSimilarTransaction?.categoryID || 0;

  // Add transaction to the database
  console.log("Adding transaction to the database");
  await new Promise<void>((resolve, reject) => {
    db.run(
      `INSERT INTO TRANSACTIONSTABLE (
        transactionsTableID,
        itemID,
        amount,
        transactionCurrency,
        conversionRateNew,
        date,
        transactionTypeID,
        categoryID,
        accountID,
        notes,
        status,
        accountReference,
        accountPairID,
        uidPairID,
        deletedTransaction,
        newSplitTransactionID,
        transferGroupID
      ) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )`,
      [
        transactionId,
        item.itemTableID,
        amount,
        currency,
        conversionRateNew,
        bluecoinsDateFormat(transaction.date),
        transaction.deposit === 0 ? 3 : 4,
        categoryID,
        accountId,
        transaction.description,
        0,
        1,
        accountId,
        transactionId,
        6,
        0,
        0,
      ],
      (err) => {
        if (err) {
          console.error(err);
          reject(err);
        } else resolve();
      }
    );
  });

  // Update tracker info
  console.log("Updating tracker file...");
  const file = await fs.readFile(constants.tracker.local, "utf8");
  const tracker = JSON.parse(file) as TrackerData;
  tracker[0].txn = (Number(tracker[0].txn) + 1).toString();
  tracker[1].tracking_id = transactionId.toString();
  tracker[2].timestamp = transactionId.toString();
  await fs.writeFile(constants.tracker.local, JSON.stringify(tracker));

  // Close the database
  console.log("Closing the database");
  db.close();
}
