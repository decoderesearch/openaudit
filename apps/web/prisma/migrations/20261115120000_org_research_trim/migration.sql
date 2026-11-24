-- The site shows no investors, safety frameworks, incident impact, repercussions or resolution,
-- and no departure join date.
DROP TABLE "org_investor";
DROP TABLE "org_safety_framework";

ALTER TABLE "org_incident" DROP COLUMN "primaryImpact",
DROP COLUMN "repercussions",
DROP COLUMN "resolution";

ALTER TABLE "org_departure" DROP COLUMN "joinedDate";
