import { config as envConfig } from "dotenv";
import path from "path";
import * as bluecoins from "./bluecoins";
import * as dropbox from "./dropbox";
import * as hdfc from "./hdfc";
import * as telegram from "./telegram";
import { killSelf } from "./utils";

envConfig({ path: path.resolve(__dirname, "../.env") });

async function main() {
  // Get new transactions from HDFC
  console.log("Getting new transactions from HDFC...");
  const newTransactions = await hdfc.getTransactions();
  if (!newTransactions.length) {
    console.log("\nNo new transactions found");
    return;
  }

  // Download latest database
  console.log("\nDownloading latest database...");
  await dropbox.downloadFiles();

  let count = 0;
  for (const transaction of newTransactions) {
    console.log(`\n[ Transaction ${++count} / ${newTransactions.length} ]`);

    // Send transaction to Telegram
    console.log("Sending transaction to Telegram...");
    await telegram.notifyTransaction(
      transaction.transaction,
      transaction.accountName
    );

    try {
      // Add new transaction to database
      console.log("Adding new transaction to database...");
      await bluecoins.addTransaction(
        transaction.transaction,
        transaction.accountId
      );
    } catch (err) {
      // Send Telegram message about failure
      console.error(err);
      console.log("Sending Telegram message about failure...");
      await telegram.notifyBluecoinsFailure();
    }
  }

  // Upload latest database
  console.log("\nUploading latest database...");
  await dropbox.uploadFiles();

  // Kill entire process after runnning
  killSelf();
}

main();
