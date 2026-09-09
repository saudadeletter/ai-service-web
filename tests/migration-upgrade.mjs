import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
// Exercise the actual SQL upgrade with v0.3 data in a private, rolled-back
// schema. It does not reset or alter the test application's existing tables.
export async function migrationUpgradeCheck({ check, sql }) {
  await check("v0.3 有历史订单的增量迁移保留原始流水与金额约束", async () => {
    const client = await sql.connect();
    const schema = `upgrade_${randomBytes(8).toString("hex")}`;
    try {
      await client.query("BEGIN");
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path TO "${schema}"`);
      for (const file of [
        "202609090001_request_management",
        "202609090002_catalog_orders",
      ])
        await client.query(
          await readFile(`prisma/migrations/${file}/migration.sql`, "utf8"),
        );
      await client.query(
        `INSERT INTO "ServiceRequest" ("id","number","lookupHash","payloadHash","service","scene","description","timeline","budget","contactType","contact","updatedAt") VALUES ('legacy-request','legacy-request-number','legacy-query-hash','legacy-payload-hash','test','test','migration fixture','test','test','email','migration@example.com',now())`,
      );
      await client.query(
        `INSERT INTO "ServicePackage" ("id","creationHash","name","service","description","priceCents","updatedAt") VALUES ('legacy-package','legacy-package-hash','legacy package','test','migration fixture',2000,now())`,
      );
      await client.query(
        `INSERT INTO "ServiceOrder" ("id","number","requestId","packageId","conversionHash","title","service","amountCents","paidCents","refundedCents","deliveryTerms","deliveryNote","status","updatedAt") VALUES ('legacy-order','legacy-order-number','legacy-request','legacy-package','legacy-conversion-hash','legacy title','test',2000,2000,500,'legacy agreement','legacy delivery','COMPLETED',now())`,
      );
      await client.query(
        `INSERT INTO "MoneyEntry" ("id","orderId","idempotencyKey","payloadHash","kind","amountCents","reference","note","actor") VALUES ('legacy-payment','legacy-order','legacy-payment-key','legacy-payment-hash','PAYMENT',2000,'original-payment-reference','original note','legacy-admin'), ('legacy-refund','legacy-order','legacy-refund-key','legacy-refund-hash','REFUND',500,'original-refund-reference','original refund note','legacy-admin')`,
      );
      const oldOrder = (await client.query('SELECT * FROM "ServiceOrder"'))
        .rows[0];
      const oldEntries = (
        await client.query('SELECT * FROM "MoneyEntry" ORDER BY "id"')
      ).rows;
      await client.query(
        await readFile(
          "prisma/migrations/202609090003_ledger_corrections/migration.sql",
          "utf8",
        ),
      );
      const { needsReview, ...newOrder } = (
        await client.query('SELECT * FROM "ServiceOrder"')
      ).rows[0];
      assert.equal(needsReview, false);
      assert.deepEqual(newOrder, oldOrder);
      assert.deepEqual(
        (await client.query('SELECT * FROM "MoneyEntry" ORDER BY "id"')).rows,
        oldEntries,
      );
      await client.query("SAVEPOINT check_totals");
      await assert.rejects(
        () => client.query('UPDATE "ServiceOrder" SET "refundedCents"=2500'),
        (e) => e.code === "23514",
      );
      await client.query("ROLLBACK TO SAVEPOINT check_totals");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
}
