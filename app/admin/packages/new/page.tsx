import { requireAdminPage } from "@/lib/server/auth";
import { AdminNav } from "@/components/admin-nav";
import { PackageForm } from "@/components/package-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "创建套餐" };
export default async function NewPackage() {
  await requireAdminPage();
  return (
    <div className="container page-shell">
      <AdminNav />
      <div className="section-heading">
        <h1>创建服务套餐</h1>
      </div>
      <PackageForm />
    </div>
  );
}
