const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function clearRooms() {
  try {
    // Delete all records from the Room table
    const deleteCount = await prisma.room.deleteMany({});
    console.log(`Successfully deleted ${deleteCount.count} rooms.`);
  } catch (error) {
    console.error('Error deleting rooms:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearRooms();