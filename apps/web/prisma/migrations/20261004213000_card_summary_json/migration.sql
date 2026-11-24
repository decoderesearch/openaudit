-- The executive summary becomes { concerns, strengths, unknowns }. Older Markdown summaries stay as JSON strings.
ALTER TABLE "openaudit_card_version" ALTER COLUMN "summary" TYPE JSONB USING to_jsonb("summary");
