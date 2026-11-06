import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <main className="px-6 pb-24 pt-10">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span className="eyebrow text-magenta">Instructor · Admin</span>
            <h1 className="headline text-[40px] md:text-[52px]">Ops.</h1>
          </div>
          <AdminNav />
        </div>
        {children}
      </div>
    </main>
  );
}
