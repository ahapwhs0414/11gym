-- DutyLog.status is being narrowed to SCHEDULED/COMPLETED/ABSENT; NORMAL/LATE/EARLY_END
-- are replaced by independent boolean flags (startedLate/endedEarly), since attendance
-- and departure outcomes are separate facts (see spec §50). The duty_logs table has no
-- rows yet (Phase 7 is the first feature to use it), so this is a safe, lossless change.
BEGIN;
ALTER TABLE "duty_logs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "duty_logs" ALTER COLUMN "status" TYPE TEXT USING ("status"::TEXT);
DROP TYPE "DutyLogStatus";
CREATE TYPE "DutyLogStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'ABSENT');
ALTER TABLE "duty_logs" ALTER COLUMN "status" TYPE "DutyLogStatus" USING ("status"::"DutyLogStatus");
ALTER TABLE "duty_logs" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
COMMIT;

-- AlterTable
ALTER TABLE "duty_logs" ADD COLUMN "startedLate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "duty_logs" ADD COLUMN "endedEarly" BOOLEAN NOT NULL DEFAULT false;
