import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  await prisma.tRANSACTIONSTABLE.deleteMany({
    where: { deletedTransaction: 5 },
  });
}

main();
