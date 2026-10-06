-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "onDemandId" TEXT;

-- CreateTable
CREATE TABLE "OnDemandActivity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "categoryId" TEXT,
    "assigneeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnDemandActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnDemandActivity_assigneeId_idx" ON "OnDemandActivity"("assigneeId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_onDemandId_fkey" FOREIGN KEY ("onDemandId") REFERENCES "OnDemandActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnDemandActivity" ADD CONSTRAINT "OnDemandActivity_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnDemandActivity" ADD CONSTRAINT "OnDemandActivity_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnDemandActivity" ADD CONSTRAINT "OnDemandActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

