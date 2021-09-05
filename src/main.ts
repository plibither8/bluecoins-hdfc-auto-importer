import { config as envConfig } from "dotenv";
import path from "path";
import * as dropbox from "./dropbox";
import * as hdfc from "./hdfc";
import * as bluecoins from "./bluecoins";
import * as telegram from "./telegram";

envConfig({ path: path.resolve(__dirname, "../.env") });

async function main() {
  // Get new transactions from HDFC
  console.log("Getting new transactions from HDFC...");
  const newTransactions = await hdfc.getTransactions();
  if (!newTransactions.length) {
    console.log("No new transactions found");
    return;
  }

  // Download latest database
  console.log("Downloading latest database...");
  await dropbox.downloadFiles();

  for (const transaction of newTransactions) {
    // Send transaction to Telegram
    console.log("Sending transaction to Telegram...");
    await telegram.notifyTransaction(
      transaction.transaction,
      transaction.accountName
    );

    // Add new transaction to database
    console.log("Adding new transaction to database...");
    await bluecoins.addTransaction(
      transaction.transaction,
      transaction.accountId
    );

    // Send Telegram message about Bluecoins
    console.log("Sending Telegram message about Bluecoins...");
    await telegram.notifyBluecoinsAddition();
  }

  // Upload latest database
  console.log("Uploading latest database...");
  await dropbox.uploadFiles();
}

main();
