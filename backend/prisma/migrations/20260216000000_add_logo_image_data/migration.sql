-- Add logo image data to tournaments
ALTER TABLE "tournaments"
ADD COLUMN "logoImageData" BYTEA,
ADD COLUMN "logoImageMimeType" TEXT;

