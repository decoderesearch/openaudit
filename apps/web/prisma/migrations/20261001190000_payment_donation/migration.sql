-- The optional donation in a payment. `amountCents` stays the total paid.
ALTER TABLE "payment" ADD COLUMN "donationCents" INTEGER NOT NULL DEFAULT 0;
