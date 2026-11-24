-- A model page: a short page about a model (specs and use), with no safety tests.
ALTER TABLE "document" DROP CONSTRAINT "document_kind_check";
ALTER TABLE "document" ADD CONSTRAINT "document_kind_check" CHECK (
  "kind" IN ('system_card', 'technical_report', 'safety_report', 'model_page', 'blog')
);
