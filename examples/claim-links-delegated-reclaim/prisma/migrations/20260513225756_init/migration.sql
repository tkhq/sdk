-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chain" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "amountRaw" TEXT NOT NULL,
    "amountDisplay" TEXT NOT NULL,
    "subOrgId" TEXT NOT NULL,
    "escrowAddress" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "senderTurnkeyUserId" TEXT NOT NULL,
    "senderEmail" TEXT,
    "senderAddress" TEXT NOT NULL,
    "recipientHint" TEXT,
    "claimKeyPublicKey" TEXT NOT NULL,
    "sweepKeyPublicKey" TEXT NOT NULL,
    "sweepKeyPrivateKeyEnc" TEXT NOT NULL,
    "sweepPolicyId" TEXT NOT NULL,
    "expirationSeconds" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "fundedAt" DATETIME,
    "fundTxHash" TEXT,
    "claimedAt" DATETIME,
    "claimTxHash" TEXT,
    "claimedToAddress" TEXT,
    "reclaimedAt" DATETIME,
    "reclaimTxHash" TEXT,
    "reclaimMode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Claim_subOrgId_key" ON "Claim"("subOrgId");

-- CreateIndex
CREATE INDEX "Claim_senderTurnkeyUserId_idx" ON "Claim"("senderTurnkeyUserId");

-- CreateIndex
CREATE INDEX "Claim_state_idx" ON "Claim"("state");
