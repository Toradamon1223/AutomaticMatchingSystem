-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isWaitlist" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "entryEndAt" TIMESTAMP(3),
ADD COLUMN     "entryStartAt" TIMESTAMP(3);
