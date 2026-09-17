import { ShopProfileForm } from '@/components/settings/shop-profile-form';

export default function ShopProfilePage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Shop Profile</h1><p className="text-muted-foreground">Manage the business details printed on receipts.</p></div>
      <ShopProfileForm />
    </div>
  );
}
