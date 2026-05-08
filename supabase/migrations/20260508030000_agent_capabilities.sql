-- Agent capabilities: what the receptionist is allowed to do on a call.
-- Values: 'booking' | 'messaging' | 'faq'
-- Default = all three enabled (backward-compatible with existing workspaces).
ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS agent_capabilities text[]
    NOT NULL DEFAULT '{booking,messaging,faq}';
