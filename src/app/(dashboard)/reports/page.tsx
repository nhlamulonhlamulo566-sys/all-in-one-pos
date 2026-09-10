import { InventoryChart } from "@/components/reports/inventory-chart";
import { SalesByProductChart } from "@/components/reports/sales-by-product-chart";
import { AdvancedPosSummary } from "@/components/reports/advanced-pos-summary";

export default function ReportsPage() {
    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center">
                <h1 className="text-lg font-semibold md:text-2xl">Reports</h1>
            </div>
                <AdvancedPosSummary />
            <InventoryChart />
            <SalesByProductChart />
        </div>
    );
}
