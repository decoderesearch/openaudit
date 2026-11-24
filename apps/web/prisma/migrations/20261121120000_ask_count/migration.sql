-- Daily question counts for the site assistant: per IP hash, and for all.
CREATE TABLE "ask_count" (
    "day" DATE NOT NULL,
    "bucket" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ask_count_pkey" PRIMARY KEY ("day","bucket")
);
