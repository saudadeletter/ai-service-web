import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
export async function commerceChecks({
  check,
  call,
  sql,
  base,
  cookie,
  id,
  number,
  lookupKey,
  requestIds,
  packageIds,
}) {
  const key = () => randomBytes(24).toString("hex");
  const auth = { cookie };
  const patch = { cookie, method: "PATCH" };
  const packageId = randomUUID();
  packageIds.push(packageId);
  const pack = {
    id: packageId,
    name: `测试套餐-${key().slice(0, 8)}`,
    service: "专属 AI 助手定制",
    description: "提供课程复习框架和一份可执行的复习计划。",
    price: "99.90",
    isActive: false,
  };
  const { id: _id, ...packFields } = pack;
  await check("新增管理页面和接口均要求登录", async () => {
    for (const path of [
      "/admin/packages",
      "/admin/packages/new",
      `/admin/packages/${packageId}`,
      "/admin/orders",
      "/admin/orders/unknown",
    ]) {
      const r = await fetch(base + path, { redirect: "manual" });
      assert.equal(r.status, 307);
    }
    for (const [path, method] of [
      ["/api/admin/packages", "POST"],
      [`/api/admin/packages/${packageId}`, "PATCH"],
      [`/api/admin/requests/${id}/order`, "POST"],
      ["/api/admin/orders/unknown", "PATCH"],
      ["/api/admin/orders/unknown/money", "POST"],
    ])
      assert.equal((await call(path, {}, { method })).response.status, 401);
  });
  await check("套餐初始下架且公开页面不泄露草稿", async () => {
    assert.equal(
      (await call("/api/admin/packages", pack, auth)).response.status,
      201,
    );
    const r = await fetch(base + "/packages");
    assert.equal(r.status, 200);
    assert.equal((await r.text()).includes(pack.name), false);
  });
  await check("创建套餐重试只保留一条", async () => {
    assert.equal(
      (await call("/api/admin/packages", pack, auth)).response.status,
      201,
    );
    const { rows } = await sql.query(
      'SELECT count(*)::int AS n FROM "ServicePackage" WHERE "id"=$1',
      [packageId],
    );
    assert.equal(rows[0].n, 1);
  });
  await check("金额校验拒绝零、负数与超过两位小数", async () => {
    for (const price of ["0", "-1", "0.001", "100000.01"])
      assert.equal(
        (
          await call(
            `/api/admin/packages/${packageId}`,
            { ...packFields, price, revision: 0 },
            patch,
          )
        ).response.status,
        400,
      );
  });
  await check("上架展示准确价格，旧版本修改被拒绝", async () => {
    assert.equal(
      (
        await call(
          `/api/admin/packages/${packageId}`,
          { ...packFields, isActive: true, revision: 0 },
          patch,
        )
      ).response.status,
      200,
    );
    assert.equal(
      (
        await call(
          `/api/admin/packages/${packageId}`,
          { ...packFields, revision: 0 },
          patch,
        )
      ).response.status,
      409,
    );
    const html = await (await fetch(base + "/packages")).text();
    assert.ok(html.includes(pack.name));
    assert.ok(html.includes("99.90"));
  });
  const conversion = {
    requestRevision: 1,
    packageId,
    packageRevision: 1,
    amount: "88.88",
    deliveryTerms: "三天内提供复习框架与使用说明，包含一次反馈调整。",
    confirmed: true,
  };
  let orderId,
    orderNumber,
    revision = 0;
  await check("转换订单要求成交确认且检查套餐版本", async () => {
    assert.equal(
      (
        await call(
          `/api/admin/requests/${id}/order`,
          { ...conversion, confirmed: false },
          auth,
        )
      ).response.status,
      400,
    );
    assert.equal(
      (
        await call(
          `/api/admin/requests/${id}/order`,
          { ...conversion, packageRevision: 0 },
          auth,
        )
      ).response.status,
      409,
    );
  });
  await check("并发转换同一咨询只生成一个订单与初始记录", async () => {
    const results = await Promise.all([
      call(`/api/admin/requests/${id}/order`, conversion, auth),
      call(`/api/admin/requests/${id}/order`, conversion, auth),
    ]);
    for (const r of results)
      assert.equal(r.response.status, 201, JSON.stringify(r.data));
    assert.equal(results[0].data.id, results[1].data.id);
    orderId = results[0].data.id;
    orderNumber = results[0].data.number;
    const { rows } = await sql.query(
      'SELECT "amountCents", (SELECT count(*)::int FROM "OrderEvent" WHERE "orderId"="ServiceOrder"."id") AS events FROM "ServiceOrder" WHERE "requestId"=$1',
      [id],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].amountCents, 8888);
    assert.equal(rows[0].events, 1);
  });
  await check("订单快照不随套餐调价或下架改变", async () => {
    assert.equal(
      (
        await call(
          `/api/admin/packages/${packageId}`,
          {
            ...packFields,
            name: "修改后的套餐",
            price: "199.00",
            isActive: false,
            revision: 1,
          },
          patch,
        )
      ).response.status,
      200,
    );
    const r = await call("/api/requests/lookup", { number, lookupKey });
    assert.equal(r.data.order.amountCents, 8888);
    assert.equal(r.data.order.title, pack.name);
    assert.equal(
      (await call(`/api/admin/requests/${id}/order`, conversion, auth)).response
        .status,
      201,
    );
    assert.equal(
      (
        await call(
          `/api/admin/requests/${id}/order`,
          { ...conversion, amount: "99.00" },
          auth,
        )
      ).response.status,
      409,
    );
  });
  await check("原查询凭证可查订单且只返回公开字段", async () => {
    const r = await call("/api/requests/lookup", { number, lookupKey });
    assert.equal(r.data.order.number, orderNumber);
    assert.deepEqual(
      Object.keys(r.data.order).sort(),
      [
        "number",
        "title",
        "service",
        "amountCents",
        "paidCents",
        "refundedCents",
        "deliveryTerms",
        "deliveryNote",
        "publicNote",
        "status",
        "createdAt",
        "updatedAt",
      ].sort(),
    );
    assert.equal(
      (await call("/api/requests/lookup", { number, lookupKey: key() }))
        .response.status,
      404,
    );
  });
  const payment = {
    kind: "PAYMENT",
    amount: "33.33",
    reference: `pay-${key()}`,
    note: "核对测试交易已到账",
    confirmed: true,
    idempotencyKey: key(),
    revision: 0,
  };
  await check("收退款跨站请求与未经确认登记被拒绝", async () => {
    assert.equal(
      (
        await call(`/api/admin/orders/${orderId}/money`, payment, {
          cookie,
          origin: "https://other.example",
        })
      ).response.status,
      403,
    );
    assert.equal(
      (
        await call(
          `/api/admin/orders/${orderId}/money`,
          { ...payment, confirmed: false },
          auth,
        )
      ).response.status,
      400,
    );
  });
  const statusUpdate = (status, deliveryNote = "") => ({
    revision,
    status,
    publicNote: "订单处理中",
    deliveryNote,
  });
  await check("未足额收款不能推进交付", async () => {
    assert.equal(
      (
        await call(
          `/api/admin/orders/${orderId}`,
          statusUpdate("IN_PROGRESS"),
          patch,
        )
      ).response.status,
      409,
    );
  });
  await check("并发收款重试只入账一次且以整数分保存", async () => {
    const results = await Promise.all([
      call(`/api/admin/orders/${orderId}/money`, payment, auth),
      call(`/api/admin/orders/${orderId}/money`, payment, auth),
    ]);
    for (const r of results)
      assert.equal(r.response.status, 201, JSON.stringify(r.data));
    assert.equal(results[0].data.id, results[1].data.id);
    revision = results[0].data.revision;
    const { rows } = await sql.query(
      'SELECT "paidCents", (SELECT count(*)::int FROM "MoneyEntry" WHERE "orderId"="ServiceOrder"."id") AS entries FROM "ServiceOrder" WHERE "id"=$1',
      [orderId],
    );
    assert.equal(rows[0].paidCents, 3333);
    assert.equal(rows[0].entries, 1);
  });
  await check("重用凭证、超额收款和超额退款不会改变余额", async () => {
    for (const [changes, status] of [
      [{ idempotencyKey: key() }, 409],
      [{ amount: "60.00", reference: key(), idempotencyKey: key() }, 400],
      [
        {
          kind: "REFUND",
          amount: "40.00",
          reference: key(),
          idempotencyKey: key(),
        },
        400,
      ],
    ])
      assert.equal(
        (
          await call(
            `/api/admin/orders/${orderId}/money`,
            { ...payment, revision, ...changes },
            auth,
          )
        ).response.status,
        status,
      );
    const r = await call("/api/requests/lookup", { number, lookupKey });
    assert.equal(r.data.order.paidCents, 3333);
    assert.equal(r.data.order.refundedCents, 0);
  });
  await check("并发不同收款使用版本校验防止超收", async () => {
    const rows = await Promise.all(
      [1, 2].map(() =>
        call(
          `/api/admin/orders/${orderId}/money`,
          {
            ...payment,
            revision,
            amount: "55.55",
            reference: key(),
            idempotencyKey: key(),
          },
          auth,
        ),
      ),
    );
    assert.deepEqual(rows.map((r) => r.response.status).sort(), [201, 409]);
    revision = rows.find((r) => r.response.status === 201).data.revision;
    const r = await call("/api/requests/lookup", { number, lookupKey });
    assert.equal(r.data.order.paidCents, 8888);
  });
  await check("收款凭据和核对备注不出现在用户查询中", async () => {
    const r = await call("/api/requests/lookup", { number, lookupKey });
    const text = JSON.stringify(r.data);
    for (const secret of [
      payment.reference,
      payment.note,
      payment.idempotencyKey,
    ])
      assert.equal(text.includes(secret), false);
  });
  await check("交付状态按顺序推进且必须提供交付说明", async () => {
    assert.equal(
      (
        await call(
          `/api/admin/orders/${orderId}`,
          statusUpdate("COMPLETED", "测试交付"),
          patch,
        )
      ).response.status,
      409,
    );
    let r = await call(
      `/api/admin/orders/${orderId}`,
      statusUpdate("IN_PROGRESS"),
      patch,
    );
    assert.equal(r.response.status, 200);
    revision = r.data.revision;
    assert.equal(
      (
        await call(
          `/api/admin/orders/${orderId}`,
          statusUpdate("DELIVERED"),
          patch,
        )
      ).response.status,
      400,
    );
    r = await call(
      `/api/admin/orders/${orderId}`,
      statusUpdate("DELIVERED", "已提供复习框架和使用说明。"),
      patch,
    );
    assert.equal(r.response.status, 200);
    revision = r.data.revision;
    r = await call(
      `/api/admin/orders/${orderId}`,
      statusUpdate("COMPLETED", "用户确认已收到复习框架与使用说明。"),
      patch,
    );
    assert.equal(r.response.status, 200);
    revision = r.data.revision;
    assert.equal(
      (
        await call(
          `/api/admin/orders/${orderId}`,
          { ...statusUpdate("COMPLETED", "更改"), revision: 0 },
          patch,
        )
      ).response.status,
      409,
    );
  });
  await check("完成后的退款独立登记并保留交付历史", async () => {
    const refund = {
      ...payment,
      revision,
      kind: "REFUND",
      amount: "8.88",
      reference: key(),
      idempotencyKey: key(),
    };
    const r = await call(`/api/admin/orders/${orderId}/money`, refund, auth);
    assert.equal(r.response.status, 201);
    revision = r.data.revision;
    const result = await call("/api/requests/lookup", { number, lookupKey });
    assert.equal(result.data.order.status, "COMPLETED");
    assert.equal(result.data.order.refundedCents, 888);
    assert.ok(result.data.order.deliveryNote.includes("用户确认"));
  });
  await check("后台页面显示成交快照、私有凭据与交付记录", async () => {
    for (const path of [
      "/admin/orders",
      `/admin/orders/${orderId}`,
      `/admin/requests/${id}`,
      "/admin/packages",
      `/admin/packages/${packageId}`,
    ]) {
      const r = await fetch(base + path, { headers: { Cookie: cookie } });
      assert.equal(r.status, 200);
      assert.match(r.headers.get("cache-control"), /private|no-store/);
      if (path === `/admin/orders/${orderId}`)
        assert.ok((await r.text()).includes(payment.reference));
    }
  });
  await check("有订单的需求不能被级联删除", async () => {
    await assert.rejects(
      () => sql.query('DELETE FROM "ServiceRequest" WHERE "id"=$1', [id]),
      (e) =>
        ["23503", "23001"].includes(e.code) &&
        e.constraint === "ServiceOrder_requestId_fkey",
    );
  });
  const secondId = requestIds.find((value) => value !== id);
  let secondOrder,
    secondRevision = 0;
  await check("下架套餐不能用于新的成交", async () => {
    assert.equal(
      (
        await call(
          `/api/admin/requests/${secondId}/order`,
          { ...conversion, requestRevision: 0, packageRevision: 2 },
          auth,
        )
      ).response.status,
      409,
    );
  });
  await check("取消订单必须先退清实际已登记收款", async () => {
    assert.equal(
      (
        await call(
          `/api/admin/packages/${packageId}`,
          { ...packFields, isActive: true, revision: 2 },
          patch,
        )
      ).response.status,
      200,
    );
    let r = await call(
      `/api/admin/requests/${secondId}/order`,
      {
        ...conversion,
        requestRevision: 0,
        packageRevision: 3,
        amount: "20.00",
      },
      auth,
    );
    assert.equal(r.response.status, 201);
    secondOrder = r.data.id;
    r = await call(
      `/api/admin/orders/${secondOrder}/money`,
      {
        ...payment,
        amount: "20.00",
        revision: 0,
        idempotencyKey: key(),
        reference: key(),
      },
      auth,
    );
    assert.equal(r.response.status, 201);
    secondRevision = r.data.revision;
    const cancel = () => ({
      revision: secondRevision,
      status: "CANCELLED",
      publicNote: "已沟通取消",
      deliveryNote: "",
    });
    assert.equal(
      (await call(`/api/admin/orders/${secondOrder}`, cancel(), patch)).response
        .status,
      409,
    );
    r = await call(
      `/api/admin/orders/${secondOrder}/money`,
      {
        ...payment,
        kind: "REFUND",
        amount: "20.00",
        revision: secondRevision,
        idempotencyKey: key(),
        reference: key(),
      },
      auth,
    );
    assert.equal(r.response.status, 201);
    secondRevision = r.data.revision;
    r = await call(`/api/admin/orders/${secondOrder}`, cancel(), patch);
    assert.equal(r.response.status, 200);
    secondRevision = r.data.revision;
    assert.equal(
      (
        await call(
          `/api/admin/orders/${secondOrder}/money`,
          {
            ...payment,
            amount: "1.00",
            revision: secondRevision,
            idempotencyKey: key(),
            reference: key(),
          },
          auth,
        )
      ).response.status,
      409,
    );
  });
}
