import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  const supabase = await createClient();
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .gt("ends_at", new Date().toISOString());

  return (
    <main className="px-6 pb-24 pt-10">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <span className="eyebrow text-magenta">Instructor · Admin</span>
            <h1 className="headline text-[40px] md:text-[52px]">Ops.</h1>
          </div>
          <AdminNav pending={count ?? 0} />
        </div>
        {children}
      </div>
    </main>
  );
}
