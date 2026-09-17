import { PaymentSettingsForm } from '@/components/settings/payment-settings-form';

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Payment Setup</h1><p className="text-muted-foreground">Connect the payment method used at this shop.</p></div>
      <PaymentSettingsForm />
    </div>
  );
}
