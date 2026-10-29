import { Suspense } from "react";
import { m } from "@/components/messages";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { Display } from "@/components/ui/Display";
import { Loading } from "@/components/ui/Loading";

export default function AdminPage() {
  return (
    <>
      <Display as="h1" id="orders-title" size="l">{m.admin.title}</Display>
      <Suspense fallback={<Loading label={m.common.loading} />}>
        <OrdersTable />
      </Suspense>
    </>
  );
}
