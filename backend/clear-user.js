const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function clearUsers() {
  try {
    // Delete all records from the Room table
    const deleteCount = await prisma.user.deleteMany({});
    console.log(`Successfully deleted ${deleteCount.count} users.`);
  } catch (error) {
    console.error('Error deleting rooms:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearUsers();