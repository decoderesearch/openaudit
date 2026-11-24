-- The tax Stripe added to a payment. `amountCents` stays without tax.
ALTER TABLE "payment" ADD COLUMN "taxCents" INTEGER NOT NULL DEFAULT 0;
