import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  const items = await prisma.iTEMTABLE.findMany({
    where: {
      itemAutoFillVisibility: 0,
    },
  });
  for (const item of items) {
    const itemId = item.itemTableID;
    const transactions = await prisma.tRANSACTIONSTABLE.findMany({
      where: {
        itemID: itemId,
        deletedTransaction: 6,
      },
    });
    if (
      transactions.every((transaction) => transaction.deletedTransaction === 5)
    ) {
      await prisma.tRANSACTIONSTABLE.deleteMany({
        where: {
          itemID: itemId,
        },
      });
      await prisma.iTEMTABLE.delete({
        where: { itemTableID: itemId },
      });
    }
  }
}

main();
