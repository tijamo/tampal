-- =============================================================================
-- Split the single directory_listing consent into three granular opt-ins:
-- phone, email, and (new) address. Address is materially more sensitive than
-- a phone number or email (it's a physical location), so it gets its own
-- consent rather than riding along with the others.
--
-- Enum values only in this migration; ALTER TYPE ... ADD VALUE can't be used
-- in the same transaction as a statement that references the new value (same
-- reasoning as 0004_self_service.sql's directory_listing addition).
-- =============================================================================

alter type consent_type add value if not exists 'directory_phone';
alter type consent_type add value if not exists 'directory_email';
alter type consent_type add value if not exists 'directory_address';
