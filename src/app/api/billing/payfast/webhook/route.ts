import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from '@/firebase/server';
import { writeAuditEvent } from '@/lib/audit';

function signature(fields: Record<string, string>, passphrase: string) {
  const encoded = Object.entries(fields)
    .filter(([key, value]) => key !== 'signature' && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(value.trim()).replace(/%20/g, '+')}`)
    .join('&');
  return createHash('md5').update(`${encoded}&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`).digest('hex');
}

function nextBillingDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const fields = Object.fromEntries(params.entries());
    const passphrase = process.env.PAYFAST_PASSPHRASE;
    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    if (!passphrase || !merchantId || !fields.m_payment_id || fields.merchant_id !== merchantId) return NextResponse.json({ success: false }, { status: 400 });
    if (fields.signature !== signature(fields, passphrase)) return NextResponse.json({ success: false }, { status: 400 });

    const baseUrl = process.env.PAYFAST_BASE_URL || 'https://www.payfast.co.za';
    const confirmation = await fetch(`${baseUrl}/eng/query/validate`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if ((await confirmation.text()).trim() !== 'VALID') return NextResponse.json({ success: false }, { status: 400 });
    if (fields.payment_status !== 'COMPLETE') return NextResponse.json({ success: true }, { status: 200 });

    const { firestore } = initializeFirebaseAdmin();
    await firestore.runTransaction(async (transaction) => {
      const paymentRef = firestore.collection('billing_payments').doc(fields.m_payment_id);
      const paymentSnapshot = await transaction.get(paymentRef);
      if (!paymentSnapshot.exists) throw new Error('Billing payment was not found.');
      const payment = paymentSnapshot.data()!;
      if (payment.status === 'paid') return;
      if (Math.abs(Number(fields.amount_gross) - Number(payment.amount)) > 0.01) throw new Error('PayFast amount does not match the billing payment.');
      const shopRef = firestore.collection('shops').doc(payment.shopId);
      const shopSnapshot = await transaction.get(shopRef);
      if (!shopSnapshot.exists) throw new Error('Shop was not found.');
      const currentExpiry = shopSnapshot.data()?.billingExpiresAt?.toDate?.() || shopSnapshot.data()?.billingExpiresAt;
      const baseDate = currentExpiry && new Date(currentExpiry) > new Date() ? new Date(currentExpiry) : new Date();
      transaction.update(paymentRef, { status: 'paid', providerPaymentId: fields.pf_payment_id || null, paidAt: Timestamp.now() });
      transaction.update(shopRef, { billingStatus: 'active', billingExpiresAt: Timestamp.fromDate(nextBillingDate(baseDate)), lastPaymentAt: Timestamp.now(), billingProvider: 'payfast' });
    });
    const paymentSnapshot = await firestore.collection('billing_payments').doc(fields.m_payment_id).get();
    await writeAuditEvent(firestore, { action: 'billing.payfast_paid', actorId: 'payfast-webhook', shopId: paymentSnapshot.data()?.shopId || null, entityType: 'billing_payment', entityId: fields.m_payment_id, details: { providerPaymentId: fields.pf_payment_id || null, amount: fields.amount_gross } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Unable to process PayFast notification.' }, { status: 400 });
  }
}
