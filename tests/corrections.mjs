import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
export async function correctionChecks({
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
  const orderFor = async (requestId) =>
    (
      await sql.query('SELECT * FROM "ServiceOrder" WHERE "requestId"=$1', [
        requestId,
      ])
    ).rows[0];
  const first = await orderFor(id);
  const second = await orderFor(requestIds.find((x) => x !== id));
  const entries = async (orderId) =>
    (
      await sql.query(
        'SELECT * FROM "MoneyEntry" WHERE "orderId"=$1 ORDER BY "createdAt", "id"',
        [orderId],
      )
    ).rows;
  const secondEntries = await entries(second.id);
  const oldRefund = secondEntries.find((e) => e.kind === "REFUND"),
    oldPayment = secondEntries.find((e) => e.kind === "PAYMENT");
  const path = (orderId, entryId) =>
    `/api/admin/orders/${orderId}/money/${entryId}/correction`;
  const body = (revision) => ({
    revision,
    idempotencyKey: key(),
    reason: "测试核对：原登记与实际交易不一致，需要保留原记录并更正。",
    confirmed: true,
  });
  let secondRevision = second.revision;
  await check("流水页面、冲正与复核接口均验证登录", async () => {
    for (const url of [
      `/admin/orders/${first.id}/ledger`,
      `/admin/orders/${second.id}/ledger/${oldRefund.id}`,
    ]) {
      const r = await fetch(base + url, { redirect: "manual" });
      assert.equal(r.status, 307);
      assert.equal(r.headers.get("location"), "/admin/login");
    }
    assert.equal(
      (await call(path(second.id, oldRefund.id), body(secondRevision))).response
        .status,
      401,
    );
    assert.equal(
      (
        await call(`/api/admin/orders/${second.id}/review`, {
          ...body(secondRevision),
          status: "CANCELLED",
        })
      ).response.status,
      401,
    );
  });
  await check("冲正拒绝跨站、未确认及空白原因", async () => {
    assert.equal(
      (
        await call(path(second.id, oldRefund.id), body(secondRevision), {
          cookie,
          origin: "https://other.example",
        })
      ).response.status,
      403,
    );
    assert.equal(
      (
        await call(
          path(second.id, oldRefund.id),
          { ...body(secondRevision), confirmed: false },
          auth,
        )
      ).response.status,
      400,
    );
    assert.equal(
      (
        await call(
          path(second.id, oldRefund.id),
          { ...body(secondRevision), reason: "           " },
          auth,
        )
      ).response.status,
      400,
    );
  });
  await check("跨订单流水不能被冲正或从详情读取", async () => {
    assert.equal(
      (await call(path(first.id, oldRefund.id), body(first.revision), auth))
        .response.status,
      404,
    );
    const r = await fetch(
      base + `/admin/orders/${first.id}/ledger/${oldRefund.id}`,
      { headers: { Cookie: cookie } },
    );
    assert.equal(r.status, 404);
  });
  await check("依赖退款的收款不可直接冲正，失败无残留记录", async () => {
    assert.equal(
      (await call(path(second.id, oldPayment.id), body(secondRevision), auth))
        .response.status,
      409,
    );
    const r = await orderFor(second.requestId);
    assert.equal(r.paidCents, 2000);
    assert.equal(r.needsReview, false);
    const { rows } = await sql.query(
      'SELECT count(*)::int AS n FROM "MoneyCorrection" WHERE "entryId"=$1',
      [oldPayment.id],
    );
    assert.equal(rows[0].n, 0);
  });
  const refundCorrection = body(secondRevision);
  await check("已取消订单可冲正错误退款，并发重试只更正一次", async () => {
    const results = await Promise.all([
      call(path(second.id, oldRefund.id), refundCorrection, auth),
      call(path(second.id, oldRefund.id), refundCorrection, auth),
    ]);
    for (const r of results)
      assert.equal(r.response.status, 201, JSON.stringify(r.data));
    assert.equal(results[0].data.id, results[1].data.id);
    secondRevision = results[0].data.revision;
    const r = await orderFor(second.requestId);
    assert.equal(r.status, "CANCELLED");
    assert.equal(r.refundedCents, 0);
    assert.equal(r.needsReview, true);
    const original = (await entries(second.id)).find(
      (e) => e.id === oldRefund.id,
    );
    assert.deepEqual(original, oldRefund);
  });
  await check("冲正令牌不能改用于其他原因，同笔不能再次冲正", async () => {
    assert.equal(
      (
        await call(
          path(second.id, oldRefund.id),
          { ...refundCorrection, reason: "这是一份完全不同的冲正原因说明。" },
          auth,
        )
      ).response.status,
      409,
    );
    assert.equal(
      (await call(path(second.id, oldRefund.id), body(secondRevision), auth))
        .response.status,
      409,
    );
  });
  await check("待复核订单不能更新交付或带余额维持已取消", async () => {
    assert.equal(
      (
        await call(
          `/api/admin/orders/${second.id}`,
          {
            revision: secondRevision,
            status: "CANCELLED",
            publicNote: "修改说明",
            deliveryNote: "",
          },
          patch,
        )
      ).response.status,
      409,
    );
    assert.equal(
      (
        await call(
          `/api/admin/orders/${second.id}/review`,
          { ...body(secondRevision), status: "CANCELLED" },
          auth,
        )
      ).response.status,
      409,
    );
    assert.equal(
      (
        await call(
          `/api/admin/orders/${second.id}/review`,
          { ...body(secondRevision), status: "IN_PROGRESS" },
          auth,
        )
      ).response.status,
      409,
    );
  });
  await check("复核可显式退回待处理，保留取消与更正历史", async () => {
    const r = await call(
      `/api/admin/orders/${second.id}/review`,
      { ...body(secondRevision), status: "CONFIRMED" },
      auth,
    );
    assert.equal(r.response.status, 201);
    secondRevision = r.data.revision;
    const order = await orderFor(second.requestId);
    assert.equal(order.status, "CONFIRMED");
    assert.equal(order.needsReview, false);
    const { rows } = await sql.query(
      'SELECT "previousStatus","status","paidCents" FROM "LedgerReview" WHERE "orderId"=$1',
      [second.id],
    );
    assert.deepEqual(rows[0], {
      previousStatus: "CANCELLED",
      status: "CONFIRMED",
      paidCents: 2000,
    });
  });
  await check("冲正后可重用原凭据补录正确退款并重新取消", async () => {
    let r = await call(
      `/api/admin/orders/${second.id}/money`,
      {
        revision: secondRevision,
        idempotencyKey: key(),
        kind: "REFUND",
        amount: "20.00",
        reference: oldRefund.reference,
        note: "核对后重新登记实际退款，原错误流水已冲正。",
        confirmed: true,
      },
      auth,
    );
    assert.equal(r.response.status, 201);
    secondRevision = r.data.revision;
    r = await call(
      `/api/admin/orders/${second.id}`,
      {
        revision: secondRevision,
        status: "CANCELLED",
        publicNote: "核对退款后取消",
        deliveryNote: "",
      },
      patch,
    );
    assert.equal(r.response.status, 200);
  });
  const originalFirst = (await entries(first.id)).find(
    (e) => e.kind === "PAYMENT" && e.amountCents === 3333,
  );
  let revision = first.revision;
  const correction = body(revision);
  await check("已完成订单冲正收款保留原交付，旧版本操作被拒绝", async () => {
    assert.equal(
      (
        await call(
          path(first.id, originalFirst.id),
          { ...correction, revision: 0 },
          auth,
        )
      ).response.status,
      409,
    );
    const r = await call(path(first.id, originalFirst.id), correction, auth);
    assert.equal(r.response.status, 201);
    revision = r.data.revision;
    const order = await orderFor(id);
    assert.equal(order.paidCents, 5555);
    assert.equal(order.status, "COMPLETED");
    assert.equal(order.deliveryNote, first.deliveryNote);
    assert.equal(
      (
        await call(
          `/api/admin/orders/${first.id}/review`,
          { ...body(revision), status: "COMPLETED" },
          auth,
        )
      ).response.status,
      409,
    );
  });
  await check("用户获知待复核但无法读取冲正原因和内部凭据", async () => {
    const r = await call("/api/requests/lookup", { number, lookupKey });
    assert.equal(r.data.order.needsReview, true);
    assert.equal(r.data.order.paidCents, 5555);
    const text = JSON.stringify(r.data);
    for (const secret of [
      correction.reason,
      originalFirst.reference,
      originalFirst.note,
      correction.idempotencyKey,
    ])
      assert.equal(text.includes(secret), false);
    const html = await (
      await fetch(base + `/admin/orders?review=pending`, {
        headers: { Cookie: cookie },
      })
    ).text();
    assert.ok(html.includes(first.number));
    assert.equal(html.includes(second.number), false);
  });
  await check("复核校验有效流水合计，发现不一致不清除标记", async () => {
    await sql.query(
      'UPDATE "ServiceOrder" SET "paidCents"=5500 WHERE "id"=$1',
      [first.id],
    );
    try {
      assert.equal(
        (
          await call(
            `/api/admin/orders/${first.id}/review`,
            { ...body(revision), status: "CONFIRMED" },
            auth,
          )
        ).response.status,
        409,
      );
      assert.equal((await orderFor(id)).needsReview, true);
    } finally {
      await sql.query(
        'UPDATE "ServiceOrder" SET "paidCents"=5555 WHERE "id"=$1',
        [first.id],
      );
    }
  });
  const replacement = {
    revision,
    idempotencyKey: key(),
    kind: "PAYMENT",
    amount: "33.33",
    reference: originalFirst.reference,
    note: "确认实际收款后补录正确金额，原流水保留。",
    confirmed: true,
  };
  await check("待复核的已完成订单可补录，原凭据只留一笔有效登记", async () => {
    const results = await Promise.all([
      call(`/api/admin/orders/${first.id}/money`, replacement, auth),
      call(
        `/api/admin/orders/${first.id}/money`,
        { ...replacement, idempotencyKey: key() },
        auth,
      ),
    ]);
    assert.deepEqual(results.map((r) => r.response.status).sort(), [201, 409]);
    revision = results.find((r) => r.response.status === 201).data.revision;
    assert.equal((await orderFor(id)).paidCents, 8888);
    const rows = await entries(first.id);
    assert.equal(
      rows.filter((e) => e.reference === originalFirst.reference).length,
      2,
    );
    assert.deepEqual(
      rows.find((e) => e.id === originalFirst.id),
      originalFirst,
    );
  });
  const review = { ...body(revision), status: "COMPLETED" };
  await check("复核拒绝跨站与过期页面，并发重试只保存一次", async () => {
    assert.equal(
      (
        await call(`/api/admin/orders/${first.id}/review`, review, {
          cookie,
          origin: "https://other.example",
        })
      ).response.status,
      403,
    );
    assert.equal(
      (
        await call(
          `/api/admin/orders/${first.id}/review`,
          { ...review, revision: 0 },
          auth,
        )
      ).response.status,
      409,
    );
    const results = await Promise.all([
      call(`/api/admin/orders/${first.id}/review`, review, auth),
      call(`/api/admin/orders/${first.id}/review`, review, auth),
    ]);
    for (const r of results)
      assert.equal(r.response.status, 201, JSON.stringify(r.data));
    assert.equal(results[0].data.id, results[1].data.id);
    revision = results[0].data.revision;
    const order = await orderFor(id);
    assert.equal(order.needsReview, false);
    assert.equal(order.status, "COMPLETED");
    assert.equal(order.paidCents, 8888);
    assert.equal(order.refundedCents, 888);
  });
  await check("无需复核时不能任意改状态，历史可按冲正状态筛选", async () => {
    assert.equal(
      (
        await call(
          `/api/admin/orders/${first.id}/review`,
          { ...body(revision), status: "CONFIRMED" },
          auth,
        )
      ).response.status,
      409,
    );
    for (const suffix of [
      "?state=corrected",
      "?state=active",
      "?view=reviews",
      "?view=events",
    ]) {
      const r = await fetch(
        base + `/admin/orders/${first.id}/ledger${suffix}`,
        { headers: { Cookie: cookie } },
      );
      assert.equal(r.status, 200);
      assert.match(r.headers.get("cache-control"), /private|no-store/);
      const text = await r.text();
      if (suffix === "?state=corrected")
        assert.ok(text.includes(correction.reason));
      if (suffix === "?view=reviews") assert.ok(text.includes(review.reason));
    }
    const r = await fetch(
      base + `/admin/orders/${first.id}/ledger/${originalFirst.id}`,
      { headers: { Cookie: cookie } },
    );
    assert.equal(r.status, 200);
    assert.ok((await r.text()).includes("本笔已冲正"));
  });
  // Dedicated pagination fixtures: financial behavior above uses HTTP; these
  // additional immutable rows exercise history beyond the former 50/30 limits.
  const { rows: packages } = await sql.query(
    'SELECT * FROM "ServicePackage" WHERE "id"=$1',
    [packageIds[0]],
  );
  const receipt = await call("/api/requests", {
    service: "专属 AI 助手定制",
    scene: "期末复习",
    description: "仅用于完整流水分页验收的独立测试需求。",
    timeline: "一周内",
    budget: "希望先了解报价",
    contactType: "email",
    contact: "paging-test@example.com",
    consent: true,
    lookupKey: key(),
  });
  assert.equal(receipt.response.status, 201);
  const { rows: requests } = await sql.query(
    'SELECT "id" FROM "ServiceRequest" WHERE "number"=$1',
    [receipt.data.number],
  );
  const requestId = requests[0].id;
  requestIds.push(requestId);
  const converted = await call(
    `/api/admin/requests/${requestId}/order`,
    {
      requestRevision: 0,
      packageId: packages[0].id,
      packageRevision: packages[0].revision,
      amount: "1.00",
      deliveryTerms: "分页测试数据，不对应实际交易或服务交付。",
      confirmed: true,
    },
    auth,
  );
  assert.equal(converted.response.status, 201);
  const pagingId = converted.data.id;
  const fixtures = Array.from({ length: 52 }, (_, i) => ({
    id: `c${key().slice(0, 24)}`,
    token: key(),
    reference: `paging-entry-${String(i).padStart(3, "0")}`,
    time: new Date(Date.UTC(2020, 0, 1, 0, 0, i)).toISOString(),
  }));
  await sql.query(
    `INSERT INTO "MoneyEntry" ("id","orderId","idempotencyKey","payloadHash","kind","amountCents","reference","note","actor","createdAt") SELECT f.id,$1,f.token,'pagination-fixture','PAYMENT',1,f.reference,'分页测试记录','integration-admin',f.time::timestamp FROM jsonb_to_recordset($2::jsonb) AS f(id text,token text,reference text,time text)`,
    [pagingId, JSON.stringify(fixtures)],
  );
  await sql.query('UPDATE "ServiceOrder" SET "paidCents"=52 WHERE "id"=$1', [
    pagingId,
  ]);
  await sql.query(
    `INSERT INTO "OrderEvent" ("id","orderId","status","publicNote","deliveryNote","actor","createdAt") SELECT f.id,$1,'CONFIRMED',f.reference,'','integration-admin',f.time::timestamp FROM jsonb_to_recordset($2::jsonb) AS f(id text,reference text,time text)`,
    [
      pagingId,
      JSON.stringify(
        fixtures
          .slice(0, 31)
          .map((f, i) => ({
            ...f,
            id: `c${key().slice(0, 24)}`,
            reference: `paging-event-${String(i).padStart(3, "0")}`,
          })),
      ),
    ],
  );
  await check("完整流水可读取第 50 笔之前的记录，筛选与页码有效", async () => {
    const html = async (suffix) => {
      const r = await fetch(
        base + `/admin/orders/${pagingId}/ledger${suffix}`,
        { headers: { Cookie: cookie } },
      );
      assert.equal(r.status, 200);
      return r.text();
    };
    const firstPage = await html("?page=1");
    assert.ok(firstPage.includes("paging-entry-051"));
    assert.equal(firstPage.includes("paging-entry-000"), false);
    const thirdPage = await html("?page=3");
    assert.ok(thirdPage.includes("paging-entry-000"));
    assert.equal(thirdPage.includes("paging-entry-051"), false);
    assert.equal((await html("?kind=REFUND")).includes("paging-entry-"), false);
    assert.ok((await html("?page=-1")).includes("paging-entry-051"));
  });
  await check("完整交付历史可读取第 30 条之前的记录", async () => {
    const r = await fetch(
      base + `/admin/orders/${pagingId}/ledger?view=events&page=2`,
      { headers: { Cookie: cookie } },
    );
    assert.equal(r.status, 200);
    assert.ok((await r.text()).includes("paging-event-000"));
  });
}
