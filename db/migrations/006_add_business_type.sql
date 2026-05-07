-- =============================================================================
-- Echon — Add business_type to onboarding (narrow-then-wide infrastructure)
-- Migration: 006
-- =============================================================================
-- Inserts a new "What kind of business do you run?" step at position 3 of
-- the onboarding wizard (right after the referral source step). Reshapes
-- workspaces to store the business type, and widens the onboarding_step
-- constraint to 1..12 (was 1..11) to make room.
--
-- Marketing is HVAC-first, but the schema is built so future verticals
-- (plumbing, roofing, electrical, deck/fence, etc.) can be added without
-- another schema change.
--
-- Pre-launch migration. No production data to preserve.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Widen onboarding_step constraint 1..11 → 1..12
-- ---------------------------------------------------------------------------
-- Migration 005 set the cap to 11. Adding the new business-type step bumps
-- the wizard to 12 total steps.

alter table workspaces
  drop constraint if exists workspaces_onboarding_step_check;

alter table workspaces
  add constraint workspaces_onboarding_step_check
  check (onboarding_step between 1 and 12);


-- ---------------------------------------------------------------------------
-- 2. Business type enum
-- ---------------------------------------------------------------------------
-- The pivot migration (004) dropped the DM-era business_type enum. We
-- recreate it here with a service-business shape. Order is intentional:
-- HVAC first (the wedge); other blue-collar verticals follow; 'other' is
-- the catch-all for future expansion or one-off cases.

create type business_type as enum (
  'hvac',
  'plumbing',
  'roofing',
  'electrical',
  'deck_fence',
  'landscaping',
  'general_contractor',
  'other'
);


-- ---------------------------------------------------------------------------
-- 3. workspaces — add business_type + free-text companion
-- ---------------------------------------------------------------------------
-- business_type is nullable until the user reaches Step 3. Once set, the
-- only valid combination of business_type + business_type_other is:
--   * any non-'other' value with business_type_other = NULL
--   * 'other' with business_type_other set to a non-empty trimmed string
-- (Same shape as referral_source / referral_source_other from migration 005.)

alter table workspaces
  add column business_type       business_type,
  add column business_type_other text;

alter table workspaces
  add constraint workspaces_business_type_other_check
  check (
    business_type is null
    or (business_type = 'other' and business_type_other is not null and length(trim(business_type_other)) > 0)
    or (business_type is distinct from 'other' and business_type_other is null)
  );

commit;
