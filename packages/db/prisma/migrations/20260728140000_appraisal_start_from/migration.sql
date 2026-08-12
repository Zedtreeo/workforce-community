-- Go-live anchor: only open appraisal cycles for anniversaries on/after this date.
ALTER TABLE "appraisal_settings" ADD COLUMN "start_from" DATE;
