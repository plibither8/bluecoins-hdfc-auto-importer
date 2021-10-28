import type { RefinedOutput } from "./bluecoins.interface";
import type { Transaction } from "./hdfc.interface";

export function getRefinedItemName(transaction: Transaction): RefinedOutput {
  const directAssociations: Record<string, RefinedOutput | string> = {};

  const conditionedAssociations: {
    condition: (str: string) => boolean;
    refiner: (str: string) => RefinedOutput | string;
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
      condition: (str) => /^\d+-/.test(str),
      refiner: (str) => str.split("-").slice(1).join(" "),
    },
    {
      condition: (str) => str.startsWith("INW "),
      refiner: (str) => {
        const [amount, conversionRateNew] = str
          .split(" ")[2]
          .substring(3)
          .split("@")
          .map(Number);
        return {
          itemName: "Pabio",
          overrideTransactionDetails: {
            transactionCurrency: "USD",
            amount: amount * 1000000,
            conversionRateNew,
          },
        };
      },
    },
  ];

  // First, attempt to resolve through direct association map
  let result: any = Object.entries(directAssociations).find(([key]) =>
    transaction.description.includes(key)
  );
  if (result) {
    const [_, value] = result;
    return typeof value === "string" ? { itemName: value } : value;
  }

  // Next, attempt to resolve through conditional association map
  result = conditionedAssociations.find((refiner) =>
    refiner.condition(transaction.description)
  );
  if (result) {
    const value = result.refiner(transaction.description);
    return typeof value === "string" ? { itemName: value } : value;
  }

  // Finally, just send back the description if nothing else worked
  return { itemName: transaction.description };
}
