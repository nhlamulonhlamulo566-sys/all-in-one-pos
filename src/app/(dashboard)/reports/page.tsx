import { AdvancedReport } from '@/components/reports/advanced-report';
import { AdvancedPosSummary } from '@/components/reports/advanced-pos-summary';

export default function ReportsPage() {
    return <div className="flex flex-col gap-8"><AdvancedReport /><AdvancedPosSummary /></div>;
}
