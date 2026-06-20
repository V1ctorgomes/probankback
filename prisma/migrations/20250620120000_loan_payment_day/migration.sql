-- AlterTable
ALTER TABLE "Loan" ADD COLUMN "diaPagamento" INTEGER NOT NULL DEFAULT 1;

UPDATE "Loan"
SET "diaPagamento" = EXTRACT(DAY FROM "dataInicio")::INTEGER;
