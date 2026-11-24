-- Saved copies of documents in R2, and the PDF page of each reported result.
ALTER TABLE "document" ADD COLUMN "fileUrl" TEXT,
ADD COLUMN "fileKey" TEXT,
ADD COLUMN "fileType" TEXT;

ALTER TABLE "document" ADD CONSTRAINT "document_file_check" CHECK (
    ("fileType" IS NULL OR "fileType" IN ('pdf', 'html'))
    AND ("fileKey" IS NULL) = ("fileType" IS NULL)
);

ALTER TABLE "eval_result" ADD COLUMN "sourcePdfPage" INTEGER;

ALTER TABLE "eval_result" ADD CONSTRAINT "eval_result_pdf_page_check" CHECK ("sourcePdfPage" IS NULL OR "sourcePdfPage" >= 1);
