-- Log excerpts (`IncidentLog[]`) for the incident page.
ALTER TABLE "org_incident" ADD COLUMN "logs" JSONB NOT NULL DEFAULT '[]';
