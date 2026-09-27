-- Lobby media pack add-on, and the free-plan adverts trial.
ALTER TYPE "AddOnResourceType" ADD VALUE 'DISPLAY_MEDIA';
ALTER TABLE "Organization" ADD COLUMN "displayMediaTrialStartedAt" TIMESTAMP(3);
