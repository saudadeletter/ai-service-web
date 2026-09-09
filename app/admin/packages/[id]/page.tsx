import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { AdminNav } from "@/components/admin-nav";
import { PackageForm } from "@/components/package-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "编辑套餐" };
export default async function EditPackage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const item = await db().servicePackage.findUnique({ where: { id } });
  if (!item) notFound();
  const { name, service, description, priceCents, isActive, revision } = item;
  return (
    <div className="container page-shell">
      <AdminNav />
      <div className="section-heading">
        <h1>编辑服务套餐</h1>
      </div>
      <PackageForm
        key={revision}
        item={{
          id,
          name,
          service,
          description,
          priceCents,
          isActive,
          revision,
        }}
      />
    </div>
  );
}
