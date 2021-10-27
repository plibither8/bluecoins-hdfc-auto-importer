import fetch from "node-fetch";
import { Transaction } from "./hdfc.interface";
import { formatCurrency } from "./utils";

async function sendMessage(message: string) {
  await fetch(`https://tg.mihir.ch/${process.env.TG_BOT_NAME}`, {
    method: "POST",
    body: JSON.stringify({ text: message, secret: process.env.TG_BOT_SECRET }),
    headers: { "Content-Type": "application/json" },
  });
}

export async function notifyTransaction(
  transaction: Transaction,
  account: string
) {
  const { id, description, date, withdrawal, deposit, closingBalance } =
    transaction;
  const debit = deposit === 0;
  const message = `*💰${debit ? "🔴 DEBIT" : "🟢 CREDIT"} @ ${account}*

*Amount*: ${
    debit ? `- ${formatCurrency(withdrawal)}` : `+ ${formatCurrency(deposit)}`
  }
*Description*: \`${description}\`

*Time*: \`${new Date().toTimeString().slice(0, 5)}\`
*Date*: \`${new Date(date).toDateString()}\`
*ID*: \`${id}\`

*Closing balance*: ${formatCurrency(closingBalance)}`;
  await sendMessage(message);
}

export async function notifyBluecoinsFailure() {
  const message = `❌ Failed to add transaction to Bluecoins`;
  await sendMessage(message);
}
