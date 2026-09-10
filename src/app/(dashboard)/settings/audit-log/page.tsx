import { AuditLog } from '@/components/settings/audit-log';

export default function AuditLogPage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Audit Log</h1><p className="text-muted-foreground">Review important activity in your shop.</p></div>
      <AuditLog />
    </div>
  );
}
