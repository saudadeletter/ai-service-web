import "dotenv/config";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("请先配置 DATABASE_URL。");
const apply = process.argv.includes("--apply");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const { rows } = await client.query(
    'SELECT count(*)::int AS count FROM "ServiceRequest" WHERE "status" IN (\'COMPLETED\', \'CLOSED\') AND "updatedAt" < $1 AND NOT EXISTS (SELECT 1 FROM "ServiceOrder" WHERE "requestId" = "ServiceRequest"."id")',
    [cutoff],
  );
  console.log(
    `符合清理条件的需求：${rows[0].count} 条（完成/关闭且超过 90 天未更新、没有关联订单）。`,
  );
  if (!apply) {
    console.log("仅预览，没有删除数据。确认备份后可添加 --apply 执行。");
  } else {
    await client.query("BEGIN");
    await client.query(
      'DELETE FROM "ServiceRequest" WHERE "status" IN (\'COMPLETED\', \'CLOSED\') AND "updatedAt" < $1 AND NOT EXISTS (SELECT 1 FROM "ServiceOrder" WHERE "requestId" = "ServiceRequest"."id")',
      [cutoff],
    );
    await client.query('DELETE FROM "AdminSession" WHERE "expiresAt" < now()');
    await client.query('DELETE FROM "RateBucket" WHERE "expiresAt" < now()');
    await client.query("COMMIT");
    console.log("已清理到期需求、关联处理记录、过期会话与限流记录。");
  }
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
