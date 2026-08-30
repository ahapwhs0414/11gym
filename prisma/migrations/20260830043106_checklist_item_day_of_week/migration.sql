-- AlterTable
ALTER TABLE "checklist_items" ADD COLUMN     "dayOfWeek" INTEGER;

-- CreateIndex
CREATE INDEX "checklist_items_dayOfWeek_idx" ON "checklist_items"("dayOfWeek");
