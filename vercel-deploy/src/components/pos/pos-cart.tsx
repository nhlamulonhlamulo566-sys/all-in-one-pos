'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, Trash2, Ban, Tag, Split, Gift, User } from 'lucide-react';
import type { CartItem } from './pos-client-page';
import type { Customer, SaleDiscount, Payment, PaymentProvider } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { DiscountApplier } from './discount-applier';
import { SplitPayment } from './split-payment';
import { StoreCreditRedeemer } from './store-credit-redeemer';

interface PosCartProps {
  cart: CartItem[];
  onUpdateCartItem: (productId: string, updates: Partial<CartItem>) => void;
  onRemoveFromCart: (productId: string) => void;
  onCompleteSale: (saleDetails: {
    subtotal: number;
    taxRate: number;
    tax: number;
    total: number;
    amountPaid: number;
    changeDue: number;
    paymentMethod: 'cash' | 'card';
    paymentReference?: string;
    customerId?: string;
    customerName?: string;
    discounts?: SaleDiscount[];
    discountTotal?: number;
    payments?: Payment[];
    notes?: string;
  }) => void;
  isProcessingSale: boolean;
  onCancelSale: () => void;
  customer?: Customer | null;
  onSelectCustomer?: () => void;
  cardProvider?: PaymentProvider;
}

export function PosCart({
  cart,
  onUpdateCartItem,
  onRemoveFromCart,
  onCompleteSale,
  isProcessingSale,
  onCancelSale,
  customer,
  onSelectCustomer,
  cardProvider = 'manual_terminal',
}: PosCartProps) {
  const [amountPaid, setAmountPaid] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [splitPaymentOpen, setSplitPaymentOpen] = useState(false);
  const [storeCreditOpen, setStoreCreditOpen] = useState(false);
  const [appliedDiscounts, setAppliedDiscounts] = useState<SaleDiscount[]>([]);
  const [payments, setPayments] = useState<Payment[] | undefined>();
  const [storageCreditRedeemed, setStorageCreditRedeemed] = useState(0);
  const [storeCreditCode, setStoreCreditCode] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  const subtotal = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );
  const discountTotal = appliedDiscounts.reduce((sum, d) => sum + d.appliedAmount, 0);
  const subtotalAfterDiscount = Math.max(0, subtotal - discountTotal);
  const tax = subtotalAfterDiscount * taxRate;
  const totalBeforeCredit = subtotalAfterDiscount + tax;
  const total = Math.max(0, totalBeforeCredit - storageCreditRedeemed);
  const changeDue = amountPaid > 0 ? amountPaid - total : 0;

  useEffect(() => {
    if (paymentMethod === 'card') {
      setAmountPaid(total);
    }
  }, [total, paymentMethod]);

  const handleQuantityChange = (item: CartItem, newQuantity: number) => {
    if (newQuantity > item.product.stock) {
      toast({
        variant: 'destructive',
        title: 'Not Enough Stock',
        description: `Only ${item.product.stock} units of ${item.product.name} are available.`,
      });
      onUpdateCartItem(item.product.id, { quantity: item.product.stock });
    } else {
      onUpdateCartItem(item.product.id, { quantity: newQuantity });
    }
  };


  const handleCompleteSale = () => {
    if (!payments && amountPaid < total) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Payment',
        description: `The amount paid (R${amountPaid.toFixed(
          2
        )}) is less than the total (R${total.toFixed(2)}).`,
      });
      return;
    }
    const recordedPayments: Payment[] | undefined = payments && payments.length > 1
      ? payments
      : paymentMethod === 'card'
        ? [{ method: 'card', amount: total, reference: paymentReference.trim(), provider: cardProvider, status: 'approved' }]
        : undefined;
    const saleDetails = {
      subtotal,
      taxRate,
      tax,
      total,
      amountPaid: payments ? payments.reduce((sum, p) => sum + p.amount, 0) : amountPaid,
      changeDue,
      paymentMethod,
      paymentReference: paymentMethod === 'card' ? paymentReference.trim() : undefined,
      customerId: customer?.id,
      customerName: customer?.name,
      storeCreditCode,
      storeCreditAmount: storageCreditRedeemed || undefined,
      discounts: appliedDiscounts.length > 0 ? appliedDiscounts : undefined,
      discountTotal: discountTotal > 0 ? discountTotal : undefined,
      payments: recordedPayments,
      notes: notes || undefined,
    };
    onCompleteSale(saleDetails);
    setAmountPaid(0);
    setAppliedDiscounts([]);
    setPayments(undefined);
    setStorageCreditRedeemed(0);
    setStoreCreditCode(undefined);
    setNotes('');
    setPaymentReference('');
  };

  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader>
        <CardTitle>Cart</CardTitle>
        <CardDescription>
          Items will appear here when added from the product list.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {cart.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <p className="text-muted-foreground">Your cart is empty</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="grid grid-cols-[3fr_1.5fr_1fr_1.5fr_auto] items-center gap-4 px-6 pb-2 text-sm font-medium text-muted-foreground border-b">
              <div>Description</div>
              <div className="text-left">Unit Price</div>
              <div className="text-center">Qty</div>
              <div className="text-right">Total</div>
              <div className="w-8"></div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-6">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="grid grid-cols-[3fr_1.5fr_1fr_1.5fr_auto] items-start gap-4 text-sm"
                  >
                    {/* Description */}
                    <p className="font-medium">{item.product.name}</p>

                    {/* Unit Price */}
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">R</span>
                        <Input
                          type="number"
                          value={item.price.toFixed(2)}
                          onChange={(e) =>
                            onUpdateCartItem(item.product.id, {
                              price: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 w-24"
                        />
                      </div>

                    {/* Quantity */}
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(item, parseInt(e.target.value) || 1)}
                      className="h-8 w-16 text-center mx-auto"
                      min="1"
                      max={item.product.stock}
                    />

                    {/* Total Price */}
                    <p className="font-medium text-right leading-loose">
                      R{(item.price * item.quantity).toFixed(2)}
                    </p>

                    {/* Remove Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveFromCart(item.product.id)}
                      className="text-muted-foreground hover:text-destructive h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-4 p-6 bg-muted/40">
        <div className="w-full space-y-2 text-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Customer</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSelectCustomer}
              disabled={!onSelectCustomer}
            >
              <User className="mr-2 h-4 w-4" />
              {customer ? 'Change' : 'Select'}
            </Button>
          </div>

          {customer && (
            <div className="p-2 bg-blue-50 rounded-md border border-blue-200 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-900">{customer.name}</span>
                </div>
                {customer.loyaltyPoints && (
                  <Badge variant="secondary">
                    {customer.loyaltyPoints} pts
                  </Badge>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>R{subtotal.toFixed(2)}</span>
          </div>

          {discountTotal > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>-R{discountTotal.toFixed(2)}</span>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <span>Taxes</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={Math.round(taxRate * 100)}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) / 100 || 0)}
                className="h-8 w-16 text-right"
              />
               <span className="text-muted-foreground">%</span>
            </div>
            <span>R{tax.toFixed(2)}</span>
          </div>

          {storageCreditRedeemed > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Store Credit</span>
              <span>-R{storageCreditRedeemed.toFixed(2)}</span>
            </div>
          )}

          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>R{total.toFixed(2)}</span>
          </div>
        </div>

        {/* Quick Quantity Shortcuts */}
        <div className="w-full">
          <p className="text-xs font-medium text-muted-foreground mb-2">Qty Shortcuts</p>
          <div className="grid grid-cols-4 gap-2">
            {[2, 6, 12, 24].map((qty) => (
              <Button
                key={qty}
                variant="outline"
                size="sm"
                onClick={() => {
                  if (cart.length > 0) {
                    handleQuantityChange(cart[cart.length - 1], qty);
                  }
                }}
                disabled={cart.length === 0}
              >
                x{qty}
              </Button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDiscountDialogOpen(true)}
            disabled={subtotal === 0}
          >
            <Tag className="h-4 w-4 mr-1" />
            Discount
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSplitPaymentOpen(true)}
            disabled={subtotal === 0}
          >
            <Split className="h-4 w-4 mr-1" />
            Split Pay
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStoreCreditOpen(true)}
            disabled={total === 0}
          >
            <Gift className="h-4 w-4 mr-1" />
            Credit
          </Button>
        </div>

        <div className="w-full space-y-4">
            <RadioGroup
              defaultValue="cash"
              onValueChange={(value: 'cash' | 'card') => setPaymentMethod(value)}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem value="cash" id="cash" className="peer sr-only" />
                <Label
                  htmlFor="cash"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  Cash
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="card"
                  id="card"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="card"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  Card{cardProvider !== 'manual_terminal' ? ` · ${cardProvider === 'yoco' ? 'Yoco' : cardProvider === 'ikhokha' ? 'iKhokha' : cardProvider}` : ''}
                </Label>
              </div>
            </RadioGroup>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="amount-paid" className="text-sm font-medium">
                Amount Paid
              </label>
              <Input
                id="amount-paid"
                type="number"
                placeholder="R0.00"
                value={amountPaid || ''}
                onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                className="text-right"
                disabled={paymentMethod === 'card'}
              />
            </div>
            <div className="text-right space-y-1">
              <p className="text-sm font-medium">Change Due</p>
              <p className="text-2xl font-bold">R{changeDue >= 0 ? changeDue.toFixed(2) : '0.00'}</p>
            </div>
          </div>
          {paymentMethod === 'card' && (
            <div className="space-y-1">
              <label htmlFor="payment-reference" className="text-sm font-medium">Terminal approval reference</label>
              <Input id="payment-reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Reference from the approved card receipt" />
              <p className="text-xs text-muted-foreground">Complete the payment on the {cardProvider === 'yoco' ? 'Yoco' : cardProvider === 'ikhokha' ? 'iKhokha' : 'card'} machine first, then enter its approval or receipt number.</p>
            </div>
          )}
        </div>
        <div className="w-full flex gap-2">
            <Button
                variant="destructive"
                className="w-full"
                onClick={onCancelSale}
                disabled={cart.length === 0 || isProcessingSale}
            >
                <Ban className="mr-2 h-4 w-4" />
                Cancel Sale
            </Button>
            <Button
                className="w-full"
                onClick={handleCompleteSale}
                disabled={
                    cart.length === 0 ||
                    isProcessingSale ||
                    (total > 0 && !payments && amountPaid < total)
                    || (paymentMethod === 'card' && !paymentReference.trim())
                }
            >
                {isProcessingSale && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Complete Sale
            </Button>
        </div>
      </CardFooter>

      {/* Dialogs */}
      <DiscountApplier
        open={discountDialogOpen}
        onOpenChange={setDiscountDialogOpen}
        subtotal={subtotal}
        onApplyDiscount={(discount) => {
          setAppliedDiscounts([...appliedDiscounts, discount]);
          setDiscountDialogOpen(false);
        }}
      />

      <SplitPayment
        open={splitPaymentOpen}
        onOpenChange={setSplitPaymentOpen}
        totalAmount={total}
        onApplyPayments={(paymentsArray) => {
          setPayments(paymentsArray);
          const totalPaid = paymentsArray.reduce((sum, p) => sum + p.amount, 0);
          setAmountPaid(totalPaid);
          setSplitPaymentOpen(false);
        }}
      />

      <StoreCreditRedeemer
        open={storeCreditOpen}
        onOpenChange={setStoreCreditOpen}
        totalAmount={total}
        onRedeem={(amount, code) => {
          setStorageCreditRedeemed(amount);
          setStoreCreditCode(code);
          toast({
            title: 'Store Credit Applied',
            description: `R${amount.toFixed(2)} credited`,
          });
        }}
      />
    </Card>
  );
}
