import { getSession } from '@/lib/session';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="flex min-h-screen flex-col bg-paper lg:flex-row">
      <AdminSidebar userName={session?.name || session?.email || 'Szerkesztő'} />
      <div className="flex-1 lg:h-screen lg:overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </div>
    </div>
  );
}
