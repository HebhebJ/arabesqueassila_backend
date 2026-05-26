-- Drop the auto-increment default and sequence
ALTER TABLE "Order" ALTER COLUMN "orderNumber" DROP DEFAULT;
DROP SEQUENCE IF EXISTS "Order_orderNumber_seq";

-- Convert existing integer order numbers to text
ALTER TABLE "Order" ALTER COLUMN "orderNumber" TYPE TEXT;

-- Add unique constraint
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
