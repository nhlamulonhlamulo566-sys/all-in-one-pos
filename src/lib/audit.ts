import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

type AuditEvent = {
  action: string;
  actorId: string;
  actorName?: string | null;
  shopId?: string | null;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
};

export async function writeAuditEvent(firestore: Firestore, event: AuditEvent) {
  await firestore.collection('audit_logs').add({
    ...event,
    createdAt: Timestamp.now(),
  });
}
