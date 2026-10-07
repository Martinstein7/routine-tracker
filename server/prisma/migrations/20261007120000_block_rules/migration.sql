-- CreateEnum
CREATE TYPE "BlockRepeat" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "BlockRule" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "pattern" "BlockRepeat" NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockRule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BlockRule" ADD CONSTRAINT "BlockRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

