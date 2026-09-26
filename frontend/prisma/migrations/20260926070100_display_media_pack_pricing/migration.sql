-- Default price for the lobby media pack (the platform admin can change it).
-- Separate migration: a new enum value can't be used in the transaction that adds it.
INSERT INTO "AddOnPricing" ("id", "resourceType", "pricePerUnitMonthly", "pricePerUnitOneOff", "currency", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'DISPLAY_MEDIA', 20, 150, COALESCE((SELECT "currency" FROM "AddOnPricing" LIMIT 1), 'USD'), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "AddOnPricing" WHERE "resourceType" = 'DISPLAY_MEDIA');

-- Paid plans include adverts by default; free plans get the trial.
UPDATE "SubscriptionPlan"
SET "features" = jsonb_set(COALESCE("features"::jsonb, '{}'::jsonb), '{displayMedia}', 'true'::jsonb)
WHERE "priceMonthly" > 0 AND NOT (COALESCE("features"::jsonb, '{}'::jsonb) ? 'displayMedia');
