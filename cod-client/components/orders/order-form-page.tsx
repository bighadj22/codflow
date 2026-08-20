"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, CheckCircle2, Package, Home, Landmark, User, DollarSign, Info, Save, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrderCustomerSection } from "./order-customer-section";
import { OrderProductSelector } from "./order-product-selector";
import { OrderNotesSection } from "./order-notes-section";
import { createOrder } from "@/actions/orders";
import { getCommunes } from "@/actions/wilayas";
import { getShippingRulesByProfileId } from "@/actions/shipping-profiles";
import { toast } from "sonner";
import type { Customer, Product, OrderProduct, ShippingRule, Wilaya, Commune } from "@/types";
import { useOrders, useCommon } from "@/lib/translations";
import { useLanguage } from "@/lib/i18n-context";
import { createOrderFormSchema, type OrderFormErrors } from "@/validations/orders";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  customers: Customer[];
  products: Product[];
  shippingRules: ShippingRule[];
  wilayas: Wilaya[];
}

export function OrderFormPage({ customers, products, shippingRules, wilayas }: Props) {
  const router = useRouter();
  const t = useOrders();
  const common = useCommon();
  const { locale } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<OrderFormErrors>({});

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [wilayaId, setWilayaId] = useState<number | null>(null);
  const [wilayaNameAr, setWilayaNameAr] = useState("");
  const [commune, setCommune] = useState("");
  const [pendingCommuneId, setPendingCommuneId] = useState<string | null>(null);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [loadingCommunes, setLoadingCommunes] = useState(false);
  const [address, setAddress] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<OrderProduct[]>([]);
  const [notes, setNotes] = useState("");

  // ── Delivery ───────────────────────────────────────────────────────────────
  const [deliveryType, setDeliveryType] = useState<"home" | "stop_desk">("home");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [feeAutoFilled, setFeeAutoFilled] = useState(false);
  const [deliveryModeUnavailable, setDeliveryModeUnavailable] = useState(false);
  const [productShippingRules, setProductShippingRules] = useState<ShippingRule[]>([]);
  const [loadingProductRules, setLoadingProductRules] = useState(false);

  // Fetch communes when wilayaId changes
  useEffect(() => {
    if (!wilayaId) {
      setCommunes([]);
      setCommune("");
      setPendingCommuneId(null);
      return;
    }
    setLoadingCommunes(true);
    setCommune("");
    getCommunes(wilayaId)
      .then((loaded) => {
        setCommunes(loaded);
        if (pendingCommuneId) {
          const found = loaded.find((c) => c.id === pendingCommuneId);
          if (found) setCommune(found.id);
          setPendingCommuneId(null);
        }
      })
      .catch(() => setCommunes([]))
      .finally(() => setLoadingCommunes(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wilayaId]);

  // Fetch product-specific shipping rules when products are selected
  useEffect(() => {
    // Find the first product with a shipping profile ID
    const productWithProfile = selectedProducts.find((sp) => {
      const product = products.find((p) => p.id === sp.productId);
      return product?.shippingProfileId;
    });

    if (!productWithProfile) {
      // No product has a specific shipping profile, clear product rules
      setProductShippingRules([]);
      setLoadingProductRules(false);
      return;
    }

    // Get the shipping profile ID from the product
    const product = products.find((p) => p.id === productWithProfile.productId);
    const profileId = product?.shippingProfileId;

    if (!profileId) {
      setProductShippingRules([]);
      setLoadingProductRules(false);
      return;
    }

    // Fetch shipping rules for this profile
    setLoadingProductRules(true);
    getShippingRulesByProfileId(profileId)
      .then(setProductShippingRules)
      .catch(() => setProductShippingRules([]))
      .finally(() => setLoadingProductRules(false));
  }, [selectedProducts, products]);

  // Auto-fill delivery fee when wilayaId or deliveryType changes
  useEffect(() => {
    if (!wilayaId) {
      setFeeAutoFilled(false);
      setDeliveryModeUnavailable(false);
      return;
    }

    // Prioritize product-specific shipping rules over default
    const activeRules = productShippingRules.length > 0 ? productShippingRules : shippingRules;

    if (activeRules.length === 0) {
      setFeeAutoFilled(false);
      setDeliveryModeUnavailable(false);
      return;
    }

    const rule = activeRules.find((r) => r.wilayaId === wilayaId);
    if (rule) {
      const isHome = deliveryType === "home";
      const enabled = isHome ? rule.homeEnabled : rule.stopDeskEnabled;
      if (!enabled) {
        setDeliveryFee(0);
        setFeeAutoFilled(false);
        setDeliveryModeUnavailable(true);
      } else {
        const fee = isHome ? rule.homePrice : rule.stopDeskPrice;
        setDeliveryFee(fee);
        setFeeAutoFilled(true);
        setDeliveryModeUnavailable(false);
      }
    } else {
      setFeeAutoFilled(false);
      setDeliveryModeUnavailable(false);
    }
  }, [wilayaId, deliveryType, shippingRules, productShippingRules]);

  const productVariants = Object.fromEntries(
    products.map((p) => [p.id, p.variants ?? []])
  );
  const subtotal = selectedProducts.reduce((sum, p) => sum + p.lineTotal, 0);
  const totalPrice = subtotal + deliveryFee;

  function handleCustomerSelect(customer: Customer) {
    setSelectedCustomer(customer);
    setCustomerName(customer.name);
    setPhone(customer.phone);
    setAddress(customer.address ?? "");
    if (customer.communeId) setPendingCommuneId(customer.communeId);
    const matched = wilayas.find(
      (w) => w.nameAr === customer.wilaya || w.name === customer.wilaya
    );
    if (matched) {
      setWilayaId(matched.id);
      setWilayaNameAr(matched.nameAr);
    } else {
      setWilayaId(null);
      setWilayaNameAr(customer.wilaya);
    }
  }

  function handleCustomerClear() {
    setSelectedCustomer(null);
    setCustomerName("");
    setPhone("");
    setWilayaId(null);
    setWilayaNameAr("");
    setCommune("");
    setPendingCommuneId(null);
    setCommunes([]);
    setAddress("");
  }

  function handleSave() {
    const parsed = createOrderFormSchema(locale, deliveryType).safeParse({
      customerName: customerName.trim(),
      phone: phone.trim(),
      wilayaId: wilayaId ?? 0,
      communeId: commune,
      address: address?.trim() || "",
      deliveryFee,
      products: selectedProducts,
    });

    if (!parsed.success) {
      const fieldErrors: OrderFormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof OrderFormErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      // Also surface the first error as a toast for visibility
      const firstMsg = parsed.error.issues[0]?.message;
      if (firstMsg) toast.error(firstMsg);
      return;
    }

    setErrors({});

    startTransition(async () => {
      try {
        await createOrder({
          customerId: selectedCustomer?.id || crypto.randomUUID(),
          customerName: customerName.trim(),
          phone: phone.trim(),
          wilayaId: wilayaId!,
          communeId: commune,
          address: address?.trim() || undefined,
          price: subtotal,
          notes: notes.trim() || undefined,
          orderType: "online",
          deliveryType,
          deliveryFee,
          products: selectedProducts.map((p) => ({
            productId: p.productId,
            productName: p.productName,
            variantId: p.variantId || undefined,
            variantLabel: p.variantLabel || undefined,
            quantity: p.quantity,
            pricePerUnit: p.pricePerUnit,
            lineTotal: p.lineTotal,
          })),
        });
        toast.success(t.form.success_add);
        router.push("/orders");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to create order"
        );
      }
    });
  }

  return (
    <div className="max-w-5xl mx-auto pb-48 md:pb-12 space-y-5 sm:space-y-6 animate-fade-in">
      {/* Header & Back Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center justify-end gap-2.5 sm:gap-3 w-full sm:w-auto order-last sm:order-first">
          <div className="hidden lg:flex items-center gap-3">
            <Button 
              onClick={handleSave} 
              disabled={isPending} 
              className="h-10 px-6 rounded-xl font-black text-[11px] uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-95"
            >
              {isPending ? "..." : <><Save size={14} className="me-2" /> {t.form.form_save_create}</>}
            </Button>
          </div>
          <Link
            href="/orders"
            className="group inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground hover:text-foreground transition-all shadow-sm active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left: Customer info + Delivery + Notes */}
        <div className="lg:col-span-7 space-y-6 sm:space-y-8">
          
          <Section title={t.detail.customer_info} icon={<User size={18} />}>
            <OrderCustomerSection
              customers={customers}
              wilayas={wilayas}
              selectedCustomer={selectedCustomer}
              customerName={customerName}
              phone={phone}
              wilayaId={wilayaId}
              wilayaNameAr={wilayaNameAr}
              commune={commune}
              communes={communes}
              loadingCommunes={loadingCommunes}
              address={address}
              deliveryType={deliveryType}
              onCustomerSelect={handleCustomerSelect}
              onCustomerClear={handleCustomerClear}
              onCustomerNameChange={setCustomerName}
              onPhoneChange={setPhone}
              onWilayaChange={(id, nameAr) => { setWilayaId(id); setWilayaNameAr(nameAr); }}
              onCommuneChange={setCommune}
              onAddressChange={setAddress}
            />
          </Section>

          <Section title={t.form.delivery_section} icon={<Package size={18} />}>
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest ml-1">
                  {t.form.delivery_type_label}
                </Label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeliveryType("home")}
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center gap-2 py-4 rounded-xl border transition-all active:scale-[0.98]",
                      deliveryType === "home"
                        ? "bg-primary/[0.03] border-primary/30 text-primary shadow-sm"
                        : "bg-muted/20 border-border/40 text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <Home size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{t.form.delivery_type_home}</span>
                  </button>
                  <button
                    onClick={() => setDeliveryType("stop_desk")}
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center gap-2 py-4 rounded-xl border transition-all active:scale-[0.98]",
                      deliveryType === "stop_desk"
                        ? "bg-primary/[0.03] border-primary/30 text-primary shadow-sm"
                        : "bg-muted/20 border-border/40 text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <Landmark size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{t.form.delivery_type_desk}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">
                    {t.form.delivery_fee_label}
                  </Label>
                  {feeAutoFilled && (
                    <span className="text-[8px] sm:text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                      {productShippingRules.length > 0 ? "Product Rate" : "Matched"}
                    </span>
                  )}
                  {deliveryModeUnavailable && (
                    <span className="text-[8px] sm:text-[9px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full uppercase tracking-widest">
                      Not configured
                    </span>
                  )}
                  {loadingProductRules && (
                    <span className="text-[8px] sm:text-[9px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full uppercase tracking-widest">
                      Loading...
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={deliveryFee === 0 ? "" : deliveryFee}
                    onChange={(e) => {
                      setDeliveryFee(Math.max(0, parseFloat(e.target.value) || 0));
                      setFeeAutoFilled(false);
                    }}
                    placeholder="0"
                    className="h-11 sm:h-12 bg-muted/20 border-border/40 rounded-xl sm:rounded-2xl px-4 text-sm font-bold focus:ring-primary/20 focus:border-primary/30 transition-all pe-16 tabular-nums shadow-inner"
                  />
                  <span className="absolute end-4 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                    {common.currency.symbol}
                  </span>
                </div>
              </div>
            </div>
          </Section>

          <Section title={t.detail.notes} icon={<Info size={18} />}>
            <OrderNotesSection notes={notes} onNotesChange={setNotes} />
          </Section>
        </div>

        {/* Right: Products + Submit summary */}
        <div className="lg:col-span-5 space-y-6 sm:space-y-8 lg:sticky lg:top-6">
          <Section title={t.form.products_section} icon={<ShoppingBag size={18} />}>
            <OrderProductSelector
              selectedProducts={selectedProducts}
              onChange={setSelectedProducts}
              availableProducts={products}
              productVariants={productVariants}
            />
          </Section>

          <div className="glass-card rounded-2xl sm:rounded-3xl border-border/30 overflow-hidden shadow-md">
            <div className="p-6 sm:p-8 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  <span>{t.form.products_section}</span>
                  <span className="tabular-nums">{formatPrice(subtotal, common.currency.symbol)}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                    <span>{t.form.delivery_fee_label}</span>
                    <span className="tabular-nums">{formatPrice(deliveryFee, common.currency.symbol)}</span>
                  </div>
                )}
                <div className="pt-4 border-t border-border/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">{t.form.order_total}</p>
                    <p className={cn(
                      "text-2xl sm:text-3xl font-black tracking-tight tabular-nums transition-colors font-display",
                      totalPrice > 0 ? "text-foreground" : "text-muted-foreground/30"
                    )}>
                      {formatPrice(totalPrice, common.currency.symbol)}
                    </p>
                  </div>
                  {selectedProducts.length > 0 && (
                    <div className="bg-primary/5 border border-primary/10 rounded-xl px-3 py-2 flex flex-col items-center min-w-16">
                      <span className="text-lg font-black text-primary tabular-nums leading-tight">{selectedProducts.length}</span>
                      <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest">Items</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="hidden md:flex flex-col gap-3">
                <Button
                  onClick={handleSave}
                  disabled={isPending}
                  className="w-full h-12 rounded-xl sm:rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95"
                >
                  <ShoppingBag size={16} className="me-2" />
                  {isPending ? "..." : t.form.save}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => router.push("/orders")}
                  disabled={isPending}
                  className="w-full h-11 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/50"
                >
                  {t.form.cancel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Mobile Action Bar */}
      <div className="fixed bottom-[88px] inset-x-4 z-40 lg:hidden animate-in slide-in-from-bottom-8 duration-500">
        <div className="glass-card border-white/20 dark:border-white/5 rounded-[2rem] p-2.5 sm:p-3 shadow-2xl flex items-center gap-2.5 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/orders")}
            disabled={isPending}
            className="flex-none w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-border/40 bg-white/50 dark:bg-muted/20 text-muted-foreground transition-all active:scale-90 shadow-sm"
          >
            <X size={20} />
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 h-12 sm:h-14 rounded-2xl font-black text-[10px] sm:text-[11px] uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20 active:scale-95 flex flex-col justify-center items-center gap-0.5"
          >
            {isPending ? "..." : (
              <>
                <span className="flex items-center gap-1.5"><Save size={16} /> {t.form.save}</span>
                <span className="text-[9px] opacity-70 tracking-normal font-mono">{formatPrice(totalPrice, common.currency.symbol)}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl sm:rounded-[2rem] border-border/30 overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 sm:px-8 sm:py-5 border-b border-border/10 bg-muted/5">
        {icon && (
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
            <div className="text-primary scale-90 sm:scale-100">{icon}</div>
          </div>
        )}
        <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight font-display uppercase">{title}</h2>
      </div>
      <div className="p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}
