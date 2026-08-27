-- CreateTable
CREATE TABLE "voting_closures" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "closedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voting_closures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voting_closures_weekStart_key" ON "voting_closures"("weekStart");
