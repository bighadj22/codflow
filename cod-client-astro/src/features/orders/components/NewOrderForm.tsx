import { useEffect, useRef, useState } from "react";
import {
  canScope,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { useLocale, useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import {
  createOrder,
  getDefaultShippingRules,
  getShippingRules,
  listCommunes,
  listCustomers,
  listProducts,
  listWilayas,
} from "@/features/orders/api";
import type {
  Commune,
  Customer,
  Product,
  ShippingRule,
  Wilaya,
} from "@/features/orders/types";
import { PageHeader } from "@/components/ui";
import { NewOrderCustomerCard } from "@/features/orders/components/NewOrderCustomerCard";
import { NewOrderDeliveryCard } from "@/features/orders/components/NewOrderDeliveryCard";
import {
  NewOrderProductsCard,
  type LineItem,
} from "@/features/orders/components/NewOrderProductsCard";
import { NewOrderSummaryCard } from "@/features/orders/components/NewOrderSummaryCard";

export function NewOrderForm() {
  const t = useT("orders");
  const common = useT("common");
  const auth = useT("auth");
  const locale = useLocale();
  const identity = useIdentity();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [shippingRules, setShippingRules] = useState<ShippingRule[]>([]);
  const [productRules, setProductRules] = useState<ShippingRule[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [wilayaId, setWilayaId] = useState("");
  const [communeId, setCommuneId] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryType, setDeliveryType] = useState<"home" | "stop_desk">("home");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [feeAutoFilled, setFeeAutoFilled] = useState(false);
  const [deliveryModeUnavailable, setDeliveryModeUnavailable] = useState(false);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pendingCommuneId = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      listCustomers(),
      listProducts(),
      listWilayas(),
      getDefaultShippingRules(),
    ])
      .then(([customerRows, productRows, wilayaRows, rules]) => {
        if (!alive) return;
        setCustomers(
          customerRows.status === "fulfilled" ? customerRows.value : [],
        );
        setProducts(
          productRows.status === "fulfilled" ? productRows.value : [],
        );
        setWilayas(wilayaRows.status === "fulfilled" ? wilayaRows.value : []);
        setShippingRules(rules.status === "fulfilled" ? rules.value : []);
        const failure = [customerRows, productRows, wilayaRows, rules].find(
          (result) => result.status === "rejected",
        );
        if (failure?.status === "rejected") {
          setMessage(
            failure.reason instanceof Error
              ? failure.reason.message
              : String(failure.reason),
          );
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!customerSearch.trim()) return;
    const timer = window.setTimeout(() => {
      void listCustomers(customerSearch.trim())
        .then(setCustomers)
        .catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    if (!wilayaId) {
      setCommunes([]);
      setCommuneId("");
      return;
    }
    setCommuneId("");
    void listCommunes(Number(wilayaId))
      .then((rows) => {
        setCommunes(rows);
        if (
          pendingCommuneId.current &&
          rows.some((commune) => commune.id === pendingCommuneId.current)
        ) {
          setCommuneId(pendingCommuneId.current);
        }
        pendingCommuneId.current = null;
      })
      .catch(() => setCommunes([]));
  }, [wilayaId]);

  useEffect(() => {
    const firstProductWithProfile = lines
      .map((line) => products.find((product) => product.id === line.productId))
      .find((product) => product?.shippingProfileId);
    if (!firstProductWithProfile?.shippingProfileId) {
      setProductRules([]);
      return;
    }
    void getShippingRules(firstProductWithProfile.shippingProfileId)
      .then(setProductRules)
      .catch(() => setProductRules([]));
  }, [lines, products]);

  useEffect(() => {
    const activeRules = productRules.length > 0 ? productRules : shippingRules;
    const rule = activeRules.find((item) => item.wilayaId === Number(wilayaId));
    if (!rule) {
      setFeeAutoFilled(false);
      setDeliveryModeUnavailable(false);
      return;
    }
    const enabled =
      deliveryType === "home" ? rule.homeEnabled : rule.stopDeskEnabled;
    const fee = deliveryType === "home" ? rule.homePrice : rule.stopDeskPrice;
    setDeliveryFee(enabled ? fee : 0);
    setFeeAutoFilled(enabled);
    setDeliveryModeUnavailable(!enabled);
  }, [deliveryType, wilayaId, productRules, shippingRules]);

  const selectedProduct = products.find((product) => product.id === productId);
  const variants =
    selectedProduct?.variants.filter((variant) => variant.active) ?? [];
  const selectedVariant = variants.find((variant) => variant.id === variantId);
  const subtotal = lines.reduce((total, line) => total + line.lineTotal, 0);
  const total = subtotal + deliveryFee;

  function selectCustomer(customer: Customer) {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setPhone(customer.phone);
    setAddress(customer.address ?? "");
    setCommuneId(customer.communeId ?? "");
    pendingCommuneId.current = customer.communeId ?? null;
    setWilayaId(customer.wilayaId ? String(customer.wilayaId) : "");
    setCustomerSearch(customer.name);
    if (
      customer.wilayaId &&
      String(customer.wilayaId) === wilayaId &&
      customer.communeId
    ) {
      void listCommunes(customer.wilayaId)
        .then((rows) => {
          setCommunes(rows);
          if (rows.some((commune) => commune.id === customer.communeId)) {
            setCommuneId(customer.communeId ?? "");
          }
        })
        .catch(() => setCommunes([]));
    }
  }

  function clearCustomer() {
    setCustomerId("");
    setCustomerSearch("");
    setCustomerName("");
    setPhone("");
    setWilayaId("");
    setCommuneId("");
    setCommunes([]);
    setAddress("");
    pendingCommuneId.current = null;
  }

  function addLine() {
    if (!selectedProduct || (variants.length > 0 && !selectedVariant)) return;
    const item: LineItem = {
      id: crypto.randomUUID(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      variantId: selectedVariant?.id,
      variantLabel: selectedVariant
        ? Object.values(selectedVariant.variations).join(" / ")
        : undefined,
      quantity: Math.max(1, quantity),
      pricePerUnit: selectedVariant?.price ?? selectedProduct.price,
      lineTotal:
        Math.max(1, quantity) *
        (selectedVariant?.price ?? selectedProduct.price),
    };
    setLines((current) => [...current, item]);
    setProductId("");
    setVariantId("");
    setQuantity(1);
  }

  async function save() {
    const nextErrors: Record<string, string> = {};
    if (!customerName.trim())
      nextErrors.customerName = t("form.error_customer_name");
    if (!/^0[5-7]\d{8}$/.test(phone.trim()))
      nextErrors.phone = t("form.error_invalid_phone");
    if (!wilayaId) nextErrors.wilayaId = t("form.error_wilaya");
    if (!communeId) nextErrors.communeId = t("form.error_commune");
    if (deliveryType === "home" && !address.trim())
      nextErrors.address = t("form.error_address");
    if (lines.length === 0) nextErrors.products = t("form.error_no_products");
    if (deliveryModeUnavailable)
      nextErrors.deliveryFee = t("form.error_delivery_unavailable");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    setMessage(null);
    try {
      await createOrder({
        customerId: customerId || crypto.randomUUID(),
        customerName: customerName.trim(),
        phone: phone.trim(),
        wilayaId: Number(wilayaId),
        communeId,
        address: address.trim() || undefined,
        price: subtotal,
        notes: notes.trim() || undefined,
        orderType: "online",
        deliveryType,
        deliveryFee,
        products: lines.map(({ id: _id, ...line }) => line),
      });
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
      notify.error(common("feedback.action_failed"));
      setBusy(false);
      return;
    }
    notify.flashSuccess(t("form.success_add"));
    window.location.assign("/orders");
  }

  if (!canScope(identity, "orders:create")) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {auth("no_access")}
      </p>
    );
  }

  if (loading)
    return (
      <div role="status" aria-busy="true" className="space-y-3">
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    );

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("form.title_add")}
        subtitle={t("form.new_order_subtitle")}
        backHref="/orders"
        backLabel={t("detail.back_to_orders")}
      />

      {message && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {message}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <NewOrderCustomerCard
            customerSearch={customerSearch}
            setCustomerSearch={setCustomerSearch}
            customerId={customerId}
            setCustomerId={setCustomerId}
            customerName={customerName}
            setCustomerName={setCustomerName}
            phone={phone}
            setPhone={setPhone}
            wilayaId={wilayaId}
            setWilayaId={setWilayaId}
            communeId={communeId}
            setCommuneId={setCommuneId}
            address={address}
            setAddress={setAddress}
            deliveryType={deliveryType}
            customers={customers}
            wilayas={wilayas}
            communes={communes}
            errors={errors}
            locale={locale}
            onSelectCustomer={selectCustomer}
            onClearCustomer={clearCustomer}
            pendingCommuneIdRef={pendingCommuneId}
          />

          <NewOrderDeliveryCard
            deliveryType={deliveryType}
            setDeliveryType={setDeliveryType}
            deliveryFee={deliveryFee}
            setDeliveryFee={setDeliveryFee}
            setFeeAutoFilled={setFeeAutoFilled}
            feeAutoFilled={feeAutoFilled}
            deliveryModeUnavailable={deliveryModeUnavailable}
            notes={notes}
            setNotes={setNotes}
            errors={errors}
          />
        </div>

        <div className="space-y-5 lg:sticky lg:top-5 lg:self-start">
          <NewOrderProductsCard
            products={products}
            lines={lines}
            setLines={setLines}
            productId={productId}
            setProductId={setProductId}
            variantId={variantId}
            setVariantId={setVariantId}
            quantity={quantity}
            setQuantity={setQuantity}
            errors={errors}
            locale={locale}
            onAddLine={addLine}
          />

          <NewOrderSummaryCard
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            total={total}
            busy={busy}
            locale={locale}
            onSave={save}
          />
        </div>
      </div>
    </div>
  );
}
