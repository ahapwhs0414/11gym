CREATE TYPE "ChecklistScheduleType" AS ENUM ('REGULAR', 'WEEKEND', 'SPECIAL');

ALTER TABLE "checklist_items"
ADD COLUMN "scheduleType" "ChecklistScheduleType",
ADD COLUMN "slotNumber" INTEGER;

UPDATE "checklist_items"
SET "scheduleType" = 'REGULAR'
WHERE "dayOfWeek" BETWEEN 1 AND 5;

INSERT INTO "checklist_items" (
  "id", "name", "required", "active", "sortOrder", "dayOfWeek",
  "scheduleType", "slotNumber", "createdAt", "updatedAt"
)
SELECT
  'migr_' || md5(random()::text || clock_timestamp()::text || source."id" || slots.number::text),
  source."name", source."required", source."active", source."sortOrder", NULL,
  'WEEKEND'::"ChecklistScheduleType", slots.number, source."createdAt", NOW()
FROM (
  SELECT DISTINCT ON ("name", "required") *
  FROM "checklist_items"
  WHERE "dayOfWeek" IN (0, 6) AND "active" = true
  ORDER BY "name", "required", "sortOrder", "createdAt"
) AS source
CROSS JOIN (VALUES (1), (2), (3)) AS slots(number);

UPDATE "checklist_items"
SET "active" = false,
    "scheduleType" = 'WEEKEND',
    "slotNumber" = 1,
    "dayOfWeek" = NULL
WHERE "dayOfWeek" IN (0, 6);

CREATE INDEX "checklist_items_scheduleType_slotNumber_idx"
ON "checklist_items"("scheduleType", "slotNumber");

ALTER TABLE "checklist_items"
ADD CONSTRAINT "checklist_items_scope_check" CHECK (
  ("scheduleType" IS NULL AND "dayOfWeek" IS NULL AND "slotNumber" IS NULL)
  OR ("scheduleType" = 'REGULAR' AND "dayOfWeek" BETWEEN 1 AND 5 AND "slotNumber" IS NULL)
  OR ("scheduleType" IN ('WEEKEND', 'SPECIAL') AND "dayOfWeek" IS NULL AND "slotNumber" BETWEEN 1 AND 3)
);
