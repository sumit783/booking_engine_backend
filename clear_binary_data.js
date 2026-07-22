import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing binary image data to allow schema migration...");
  
  // Set binary columns to null
  await prisma.$executeRawUnsafe(`UPDATE property SET logo = NULL, coverImage = NULL;`);
  
  // Delete rows with binary data
  await prisma.$executeRawUnsafe(`DELETE FROM roomimage;`);
  await prisma.$executeRawUnsafe(`DELETE FROM packageimage;`);
  await prisma.$executeRawUnsafe(`DELETE FROM propertygalleryimage;`);
  
  console.log("Cleared successfully.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
