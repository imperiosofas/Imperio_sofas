import { LogisticsWorkspace } from "../../../../features/admin/logistics/LogisticsWorkspace";
import {
  getAdminLogisticsAreas,
  getAdminLogisticsSuppliers,
} from "../../../../features/admin/logistics/data";

export const dynamic = "force-dynamic";

export default async function LogisticsPickupLocationsPage() {
  const [data, related] = await Promise.all([
    getAdminLogisticsSuppliers(),
    getAdminLogisticsAreas(),
  ]);
  return <LogisticsWorkspace data={data} related={related} section="pickup" />;
}
