import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle, BadgeCheck, Ban, Banknote, CheckCircle2, Clock, FileWarning, Loader2, LogOut,
  Mail, Phone, RefreshCw, RotateCcw, Scale, Search, ShieldCheck, Store, Undo2, Wallet, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { ShowMoreButton, useShowMore } from "@/components/common/ShowMore";
import MetricsPanel from "@/components/admin/MetricsPanel";
import AuditPanel from "@/components/admin/AuditPanel";
import TeamPanel from "@/components/admin/TeamPanel";
import WithdrawalsPanel from "@/components/admin/WithdrawalsPanel";
import ConversationViewer from "@/components/admin/ConversationViewer";
import { api, AdminCase, AdminVendor, CaseType } from "@/lib/api";
import { formatNaira } from "@/lib/utils";
import { useConfirm } from "@/components/common/ConfirmDialog";

const naira = (n: number | null | undefined) => formatNaira(n);
const fmtDate = (iso: string | null | undefined) => (iso ? format(new Date(iso), "d MMM yyyy") : "—");
const ago = (iso: string | null | undefined) => (iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : "");
const errorText = (e: any, fallback: string) =>
  typeof e?.response?.data?.detail === "string" ? e.response.data.detail : fallback;

const CASE_META: Record<Exclude<CaseType, null>, { label: string; tone: string; icon: typeof Scale; help: string }> = {
  dispute: {
    label: "Dispute",
    tone: "bg-red-500/10 text-red-700 border-red-200",
    icon: Scale,
    help: "Customer reported a problem. Payment is frozen until you decide.",
  },
  refund_review: {
    label: "Refund decision",
    tone: "bg-orange-500/10 text-orange-700 border-orange-200",
    icon: Undo2,
    help: "Customer cancelled after the vendor accepted. Decide who keeps the money.",
  },
  awaiting_otp: {
    label: "Waiting for Paystack OTP",
    tone: "bg-sky-500/10 text-sky-700 border-sky-200",
    icon: Clock,
    help: "Paystack is holding this transfer until an OTP is entered. Finalise it in Paystack → Transfers, then press Check with Paystack (it also re-checks automatically every 15 minutes).",
  },
  refund_needs_details: {
    label: "Refund needs an account",
    tone: "bg-amber-500/10 text-amber-800 border-amber-200",
    icon: Undo2,
    help: "Paystack couldn't send this refund back automatically. The customer has been emailed to add a refund account — it completes automatically as soon as they do. If they share details another way, finish it in Paystack → Refunds.",
  },
  failed_refund: {
    label: "Refund failed",
    tone: "bg-amber-500/10 text-amber-800 border-amber-200",
    icon: RotateCcw,
    help: "Paystack rejected the refund. Check the transaction, then retry.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("cases");

  const { data: overview } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: api.admin.overview,
    refetchInterval: 60_000,
  });

  const openCases =
    (overview?.open_disputes ?? 0) + (overview?.refund_reviews ?? 0) + (overview?.failed_refunds ?? 0);
  const withdrawalsWaiting = (overview?.payouts_awaiting_approval ?? 0) + (overview?.payouts_awaiting_otp ?? 0);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/"><img src="/Plagohive.svg" alt="Plagohive" className="w-auto object-contain h-7 sm:h-8" /></Link>
            <Badge variant="outline" className="border-primary/30 text-primary font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Admin
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-muted-foreground">{user?.email}</span>
            <Button
              variant="ghost" size="sm"
              onClick={() => { logout(); navigate("/"); }}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <section className="pt-24 sm:pt-28 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Operations</h1>
            <p className="text-muted-foreground mt-1">Verify vendors and settle anything that needs a human decision.</p>
          </div>

          {/* Overview tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Tile
              icon={Store} label="Vendors awaiting review" value={overview?.vendors_pending}
              onClick={() => setTab("vendors")} urgent={(overview?.vendors_pending ?? 0) > 0}
            />
            <Tile
              icon={Scale} label="Open disputes" value={overview?.open_disputes}
              onClick={() => setTab("cases")} urgent={(overview?.open_disputes ?? 0) > 0}
            />
            <Tile
              icon={FileWarning} label="Other cases"
              value={overview ? openCases - overview.open_disputes : undefined}
              hint={overview ? `${overview.refund_reviews} refund decisions · ${overview.failed_refunds} failed refunds` : ""}
              onClick={() => setTab("cases")}
            />
            <Tile
              icon={Wallet} label="Held for others"
              value={overview ? naira(overview.escrow_held) : undefined}
              hint={overview ? `In vendor wallets: ${naira(overview.wallet_balances)} · Our earnings: ${naira(overview.platform_earnings)}` : ""}
            />
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6 w-full sm:w-auto overflow-x-auto justify-start">
              <TabsTrigger value="cases">
                Cases {openCases > 0 && <CountPill n={openCases} />}
              </TabsTrigger>
              <TabsTrigger value="withdrawals">
                Withdrawals {withdrawalsWaiting > 0 && <CountPill n={withdrawalsWaiting} />}
              </TabsTrigger>
              <TabsTrigger value="vendors">
                Vendor verification {(overview?.vendors_pending ?? 0) > 0 && <CountPill n={overview!.vendors_pending} />}
              </TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming events</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="history">Resolved</TabsTrigger>
            </TabsList>

            <TabsContent value="cases"><CasesQueue /></TabsContent>
            <TabsContent value="withdrawals"><WithdrawalsPanel /></TabsContent>
            <TabsContent value="vendors"><VendorQueue /></TabsContent>
            <TabsContent value="upcoming"><UpcomingBoard /></TabsContent>
            <TabsContent value="metrics"><MetricsPanel /></TabsContent>
            <TabsContent value="audit"><AuditPanel /></TabsContent>
            <TabsContent value="team"><TeamPanel /></TabsContent>
            <TabsContent value="history"><History /></TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
};

const Tile = ({
  icon: Icon, label, value, hint, onClick, urgent,
}: { icon: typeof Store; label: string; value?: number | string; hint?: string; onClick?: () => void; urgent?: boolean }) => (
  <Card
    onClick={onClick}
    className={`p-5 bg-white border transition-all ${onClick ? "cursor-pointer hover:shadow-[var(--shadow-elevated)]" : ""} ${urgent ? "border-primary/40" : "border-border"}`}
  >
    <div className="flex items-start justify-between">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <Icon className={`h-4 w-4 ${urgent ? "text-primary" : "text-muted-foreground"}`} />
    </div>
    <p className="text-lg sm:text-2xl font-bold mt-2 tabular-nums">{value ?? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}</p>
    {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
  </Card>
);

const CountPill = ({ n }: { n: number }) => (
  <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-white text-[11px] font-bold">
    {n}
  </span>
);

const Empty = ({ icon: Icon, title, body }: { icon: typeof Store; title: string; body: string }) => (
  <Card className="p-12 text-center bg-white border-dashed">
    <Icon className="h-10 w-10 mx-auto text-green-600 mb-3" />
    <p className="font-semibold">{title}</p>
    <p className="text-sm text-muted-foreground mt-1">{body}</p>
  </Card>
);

// ── Cases ────────────────────────────────────────────────────────────────────

const useRefreshAdmin = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["admin"] });
};

const CasesQueue = () => {
  const { data: cases, isLoading } = useQuery({ queryKey: ["admin", "cases"], queryFn: api.admin.cases });
  const list = useShowMore(cases || [], 5);

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin mx-auto my-12 text-muted-foreground" />;
  if (!cases?.length) {
    return <Empty icon={CheckCircle2} title="Nothing needs you right now" body="Disputes, refund decisions and failed transfers will appear here." />;
  }
  return <div className="space-y-4">{list.visible.map((c) => <CaseCard key={c.id} c={c} />)}<ShowMoreButton {...list} noun="more cases" /></div>;
};

const CaseCard = ({ c, readOnly = false }: { c: AdminCase; readOnly?: boolean }) => {
  const refresh = useRefreshAdmin();
  const confirm = useConfirm();
  const [decision, setDecision] = useState<"refund" | "release" | null>(null);
  const [busy, setBusy] = useState(false);
  const meta = c.case_type ? CASE_META[c.case_type] : null;
  const Icon = meta?.icon ?? Scale;

  const retryRefund = async () => {
    setBusy(true);
    try {
      await api.admin.retryRefund(c.id);
      toast.success("Refund resent to Paystack");
      refresh();
    } catch (e) {
      toast.error(errorText(e, "Retry failed"));
    } finally {
      setBusy(false);
    }
  };

  const checkWithPaystack = async () => {
    setBusy(true);
    try {
      const updated = await api.admin.syncPayout(c.id);
      if (updated.payout_status === "paid") toast.success("Paystack confirms the transfer was successful");
      else if (updated.payout_status === "credited") toast.error("Paystack reports this transfer failed — the money is now in the vendor's wallet");
      else toast.info("Paystack is still waiting on this transfer");
      refresh();
    } catch (e) {
      toast.error(errorText(e, "Couldn't reach Paystack"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bg-white border border-border overflow-hidden">
      <div className="p-5 flex flex-col lg:flex-row gap-5">
        {/* Left: what happened */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {meta && (
              <Badge variant="outline" className={meta.tone}>
                <Icon className="h-3.5 w-3.5 mr-1" /> {meta.label}
              </Badge>
            )}
            {readOnly && c.resolution && (
              <Badge variant="outline" className={c.resolution === "refund" ? "bg-navy/10 text-navy" : "bg-green-500/10 text-green-700"}>
                {c.resolution === "refund" ? "Refunded customer" : "Released to vendor"}
              </Badge>
            )}
            <span className="font-mono text-xs text-muted-foreground">Booking #{c.id}</span>
            <span className="ml-auto"><ConversationViewer bookingId={c.id}
              defaultReason={c.case_type === "dispute" ? ((c as any).dispute_kind === "no_show" ? "No-show report review" : "Dispute review") : "Customer support request"} /></span>
            <span className="text-xs text-muted-foreground">· event {fmtDate(c.event_date)}</span>
            {c.disputed_at && !readOnly && <span className="text-xs text-muted-foreground">· reported {ago(c.disputed_at)}</span>}
          </div>

          {meta && !readOnly && <p className="text-sm text-muted-foreground">{meta.help}</p>}

          {c.dispute_reason && (
            <blockquote className="border-l-4 border-red-300 bg-red-50/60 px-4 py-3 rounded-r text-sm whitespace-pre-wrap">
              <span className="block text-xs font-semibold text-red-700 mb-1">Customer says</span>
              {c.dispute_reason}
            </blockquote>
          )}

          {c.payout_error && c.case_type === "awaiting_otp" && (
            <p className="text-sm bg-amber-50 border border-amber-200 rounded px-3 py-2">
              <span className="font-semibold">Paystack: </span>{c.payout_error}
              {!c.vendor_has_bank_account && " — ask the vendor to add their bank details in Profile → Payouts."}
            </p>
          )}

          {c.case_type === "refund_needs_details" && (
            <p className="text-sm bg-amber-50 border border-amber-200 rounded px-3 py-2">
              {c.customer_refund_account
                ? <>Customer's refund account: <b>{c.customer_refund_account.account_name}</b> · {c.customer_refund_account.bank_name} · <span className="font-mono">{c.customer_refund_account.account_number}</span></>
                : "Customer hasn't added a refund account yet."}
            </p>
          )}

          {readOnly && c.resolution_note && (
            <p className="text-sm"><span className="font-semibold">Decision note: </span>{c.resolution_note}</p>
          )}

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <Party role="Customer" name={c.customer_name} email={c.customer_email} phone={c.customer_phone} />
            <Party role="Vendor" name={c.vendor_name} email={c.vendor_email} phone={c.vendor_phone} />
          </div>
        </div>

        {/* Right: money + actions */}
        <div className="lg:w-72 flex-shrink-0 space-y-3">
          <div className="rounded-lg bg-muted/40 border border-border p-3 text-sm space-y-1.5">
            <Row label="Customer paid" value={naira(c.price)} strong />
            <Row label="Vendor price" value={naira(c.vendor_total)} />
            <Row label="Vendor payout" value={naira(c.payout_amount)} />
            <Row label="Our commission + fee" value={naira((c.commission_amount ?? 0) + (c.platform_fee ?? 0))} />
            <div className="pt-1.5 mt-1.5 border-t border-border flex gap-2 flex-wrap text-[11px] text-muted-foreground">
              <span>payout: {c.payout_status}</span>·<span>refund: {c.refund_status}</span>
            </div>
          </div>

          {!readOnly && (c.case_type === "dispute" || c.case_type === "refund_review") && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setDecision("refund")} className="border-navy/25 text-navy hover:bg-navy/5">
                <Undo2 className="h-4 w-4 mr-1.5" /> Refund
              </Button>
              <Button onClick={() => setDecision("release")} className="bg-green-600 hover:bg-green-700 text-white">
                <Banknote className="h-4 w-4 mr-1.5" /> Release
              </Button>
            </div>
          )}
          {!readOnly && c.case_type === "awaiting_otp" && (
            <Button variant="outline" className="w-full" disabled={busy} onClick={checkWithPaystack}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Check with Paystack
            </Button>
          )}
          {!readOnly && c.case_type === "failed_refund" && (
            <Button className="w-full" disabled={busy} onClick={retryRefund}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />} Retry refund
            </Button>
          )}
          {c.payment_reference && (
            <p className="text-[11px] text-muted-foreground font-mono break-all">Paystack ref: {c.payment_reference}</p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {c.receipt_number && (
              <button className="text-primary hover:underline" onClick={() => api.documents.download(c.id, "receipt")}>
                Receipt {c.receipt_number}
              </button>
            )}
            {c.payout_statement_number && (
              <button className="text-primary hover:underline" onClick={() => api.documents.download(c.id, "payout-statement")}>
                Statement {c.payout_statement_number}
              </button>
            )}
          </div>
        </div>
      </div>

      {decision && <ResolveDialog c={c} outcome={decision} onClose={() => setDecision(null)} />}
    </Card>
  );
};

const Party = ({ role, name, email, phone }: { role: string; name: string | null; email: string | null; phone: string | null }) => (
  <div className="rounded-lg border border-border p-3">
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{role}</p>
    <p className="font-semibold truncate">{name || "—"}</p>
    {email && (
      <a href={`mailto:${email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary truncate">
        <Mail className="h-3.5 w-3.5 flex-shrink-0" /> {email}
      </a>
    )}
    {phone && (
      <a href={`tel:${phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary">
        <Phone className="h-3.5 w-3.5 flex-shrink-0" /> {phone}
      </a>
    )}
  </div>
);

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className="flex justify-between gap-2">
    <span className="text-muted-foreground">{label}</span>
    <span className={strong ? "font-bold" : "font-medium"}>{value}</span>
  </div>
);

const ResolveDialog = ({ c, outcome, onClose }: { c: AdminCase; outcome: "refund" | "release"; onClose: () => void }) => {
  const refresh = useRefreshAdmin();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const refund = outcome === "refund";

  const submit = async () => {
    setBusy(true);
    try {
      await api.admin.resolve(c.id, outcome, note.trim());
      toast.success(refund ? "Customer refunded. Both parties have been emailed." : "Payment released. Both parties have been emailed.");
      refresh();
      onClose();
    } catch (e) {
      toast.error(errorText(e, "Couldn't save the decision"));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{refund ? "Refund the customer" : "Release payment to the vendor"}</DialogTitle>
          <DialogDescription>
            {refund
              ? `${naira(c.price)} goes back to ${c.customer_name || "the customer"}. The vendor receives nothing.`
              : `${naira(c.payout_amount)} is transferred to ${c.vendor_name || "the vendor"}. The customer is not refunded.`}{" "}
            This can't be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="note">Reason (emailed to both customer and vendor)</Label>
          <Textarea
            id="note" rows={4} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={refund ? "e.g. The vendor confirmed they couldn't attend." : "e.g. Photos and delivery receipt show the service was provided as agreed."}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            onClick={submit} disabled={busy || note.trim().length < 5}
            className={refund ? "bg-navy hover:bg-navy/90 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {refund ? "Confirm refund" : "Confirm release"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const History = () => {
  const { data, isLoading } = useQuery({ queryKey: ["admin", "history"], queryFn: api.admin.history });
  const list = useShowMore(data || [], 6);
  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin mx-auto my-12 text-muted-foreground" />;
  if (!data?.length) return <Empty icon={Clock} title="No decisions yet" body="Resolved disputes and refund decisions will be listed here." />;
  return (
    <><div className="space-y-4">
      {list.visible.map((c) => (
        <div key={c.id}>
          <p className="text-xs text-muted-foreground mb-1.5">Decided {fmtDate(c.resolved_at)}</p>
          <CaseCard c={c} readOnly />
        </div>
      ))}
    </div>
      <ShowMoreButton {...list} noun="more decisions" className="mt-4" /></>
  );
};

// ── Upcoming events (next 7 days) ────────────────────────────────────────────

const HEALTH = {
  green: { dot: "bg-green-500", text: "text-green-700", bg: "bg-green-50 border-green-200" },
  amber: { dot: "bg-amber-500", text: "text-amber-800", bg: "bg-amber-50 border-amber-200" },
  red: { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50 border-red-200" },
};

const UpcomingBoard = () => {
  const { data = [], isLoading } = useQuery({ queryKey: ["admin", "upcoming"], queryFn: api.admin.upcoming, refetchInterval: 60_000 });
  const list = useShowMore(data, 8);
  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin mx-auto my-12 text-muted-foreground" />;
  if (!data.length) return <Empty icon={CheckCircle2} title="No events in the next 7 days" body="Paid bookings appear here a week before the event, with live status." />;
  const counts = { red: 0, amber: 0, green: 0 } as Record<string, number>;
  data.forEach((e) => (counts[e.health] += 1));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
        {(["red", "amber", "green"] as const).map((h) => (
          <span key={h} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${HEALTH[h].bg} ${HEALTH[h].text}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${HEALTH[h].dot}`} />
            {counts[h]} {h === "red" ? "need attention" : h === "amber" ? "waiting" : "on track"}
          </span>
        ))}
      </div>
      <div className="space-y-2.5">
        {list.visible.map((e) => (
          <Card key={e.id} className={`p-4 border ${HEALTH[e.health].bg}`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="sm:w-32 flex-shrink-0">
                <p className="font-display font-bold">{format(new Date(e.event_date), "EEE d MMM")}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(e.event_date), "HH:mm")} · #{e.id}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold flex items-center gap-2 ${HEALTH[e.health].text}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${HEALTH[e.health].dot}`} /> {e.note}
                </p>
                <p className="text-sm truncate">{e.vendor_name} → {e.customer_name}{e.venue ? ` · ${e.venue}` : ""}</p>
              </div>
              <div className="flex gap-3 text-sm flex-shrink-0">
                {e.vendor_phone && <a className="text-primary hover:underline flex items-center gap-1" href={`tel:${e.vendor_phone}`}><Phone className="h-3.5 w-3.5" />Vendor</a>}
                {e.customer_phone && <a className="text-primary hover:underline flex items-center gap-1" href={`tel:${e.customer_phone}`}><Phone className="h-3.5 w-3.5" />Customer</a>}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <ShowMoreButton {...list} noun="more events" className="mt-3" />
    </div>
  );
};

// ── Vendor verification ──────────────────────────────────────────────────────

const VENDOR_FILTERS = [
  { value: "pending", label: "Awaiting review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
];

const VendorQueue = () => {
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin", "vendors", filter, search, page],
    queryFn: () => api.admin.vendors({ status: filter, q: search || undefined, page }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {VENDOR_FILTERS.map((f) => (
            <Button
              key={f.value} size="sm" variant={filter === f.value ? "default" : "outline"}
              onClick={() => { setFilter(f.value); setPage(1); }}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9" placeholder="Business, contact or email"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin mx-auto my-12 text-muted-foreground" />
      ) : !data?.vendors.length ? (
        <Empty
          icon={CheckCircle2}
          title={filter === "pending" ? "No vendors waiting" : "No vendors here"}
          body={filter === "pending" ? "New vendor sign-ups without an automatic CAC match land here." : "Try another filter or search."}
        />
      ) : (
        <div className={`space-y-4 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
          {data.vendors.map((v) => <VendorCard key={v.id} v={v} />)}
          {data.total_pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground">Page {data.page} of {data.total_pages}</span>
              <Button size="sm" variant="outline" disabled={page >= data.total_pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const cacMatch = (v: AdminVendor) => {
  if (!v.registration_number) return { tone: "text-muted-foreground", text: "No RC number provided" };
  if (!v.cac_verification_attempted) return { tone: "text-muted-foreground", text: "CAC not checked yet" };
  if (!v.cac_verified_name) return { tone: "text-red-700", text: "RC number not found on CAC" };
  const same = v.cac_verified_name.trim().toLowerCase() === v.business_name.trim().toLowerCase();
  return same
    ? { tone: "text-green-700", text: `CAC name matches: ${v.cac_verified_name}` }
    : { tone: "text-amber-700", text: `CAC registered name: ${v.cac_verified_name}` };
};

const VendorCard = ({ v }: { v: AdminVendor }) => {
  const refresh = useRefreshAdmin();
  const [action, setAction] = useState<"reject" | "suspend" | null>(null);
  const [busy, setBusy] = useState(false);
  const cac = cacMatch(v);

  const approve = async () => {
    setBusy(true);
    try {
      await api.admin.decideVerification(v.id, "approved");
      toast.success(`${v.business_name} approved — they've been emailed`);
      refresh();
    } catch (e) {
      toast.error(errorText(e, "Couldn't approve"));
    } finally {
      setBusy(false);
    }
  };

  const reinstate = async () => {
    setBusy(true);
    try {
      await api.admin.setVendorActive(v.id, true);
      toast.success(`${v.business_name} reinstated`);
      refresh();
    } catch (e) {
      toast.error(errorText(e, "Couldn't reinstate"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bg-white border border-border p-5">
      <div className="flex flex-col md:flex-row gap-5">
        <div className="flex gap-4 flex-1 min-w-0">
          {v.profile_image_url ? (
            <img src={v.profile_image_url} alt="" className="h-16 w-16 rounded-xl object-cover flex-shrink-0 border" />
          ) : (
            <div className="h-16 w-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold flex-shrink-0">
              {v.business_name[0]}
            </div>
          )}
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-lg">{v.business_name}</h3>
              <Badge variant="secondary" className="capitalize">{v.category}</Badge>
              {!v.is_active && <Badge variant="outline" className="bg-red-500/10 text-red-700">Suspended</Badge>}
              {v.auto_verified && <Badge variant="outline" className="text-green-700">Auto-verified via CAC</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {v.contact_name} · {v.location} · {v.business_size} business · from {naira(v.starting_price)}
              
              {v.logistics_fee ? ` + ${naira(v.logistics_fee)} logistics` : ""}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {v.email && <a href={`mailto:${v.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary"><Mail className="h-3.5 w-3.5" />{v.email}</a>}
              {v.phone_number && <a href={`tel:${v.phone_number}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary"><Phone className="h-3.5 w-3.5" />{v.phone_number}</a>}
            </div>
            {v.description && <p className="text-sm line-clamp-2">{v.description}</p>}

            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm pt-1">
              <span className={`flex items-center gap-1.5 ${cac.tone}`}>
                <BadgeCheck className="h-4 w-4" />
                {v.registration_number && <span className="font-mono">RC {v.registration_number} ·</span>} {cac.text}
              </span>
              <span className={`flex items-center gap-1.5 ${v.has_bank_account ? "text-green-700" : "text-muted-foreground"}`}>
                <Banknote className="h-4 w-4" /> {v.has_bank_account ? "Bank account linked" : "No bank account yet"}
              </span>
            </div>

            {(v as any).reliability && ((v as any).reliability.strikes_90d > 0 || (v as any).reliability.fees_owed > 0) && (
              <p className="text-sm text-red-700">
                {(v as any).reliability.strikes_90d} strike{(v as any).reliability.strikes_90d === 1 ? "" : "s"} in 90 days
                {(v as any).reliability.fees_owed > 0 ? ` · ${naira((v as any).reliability.fees_owed)} in fees owed` : ""}
              </p>
            )}

            {v.verification_note && (
              <p className="text-sm bg-muted/50 rounded px-3 py-2"><span className="font-semibold">Note: </span>{v.verification_note}</p>
            )}

            {v.gallery_images.length > 0 && (
              <div className="flex gap-2 pt-1 overflow-x-auto">
                {v.gallery_images.slice(0, 6).map((src) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer">
                    <img src={src} alt="" className="h-14 w-14 rounded-md object-cover border flex-shrink-0" />
                  </a>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Signed up {ago(v.created_at)}</p>
          </div>
        </div>

        <div className="md:w-48 flex md:flex-col gap-2 flex-shrink-0">
          {v.is_active && v.verification_status !== "approved" && (
            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" disabled={busy} onClick={approve}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />} Approve
            </Button>
          )}
          {v.is_active && v.verification_status !== "rejected" && (
            <Button variant="outline" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={busy} onClick={() => setAction("reject")}>
              <XCircle className="h-4 w-4 mr-1.5" /> {v.verification_status === "approved" ? "Revoke" : "Reject"}
            </Button>
          )}
          {v.is_active ? (
            <Button variant="ghost" className="flex-1 text-muted-foreground" disabled={busy} onClick={() => setAction("suspend")}>
              <Ban className="h-4 w-4 mr-1.5" /> Suspend
            </Button>
          ) : (
            <Button variant="outline" className="flex-1" disabled={busy} onClick={reinstate}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Reinstate
            </Button>
          )}
        </div>
      </div>

      {action && <VendorActionDialog v={v} action={action} onClose={() => setAction(null)} />}
    </Card>
  );
};

const VendorActionDialog = ({ v, action, onClose }: { v: AdminVendor; action: "reject" | "suspend"; onClose: () => void }) => {
  const refresh = useRefreshAdmin();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const reject = action === "reject";

  const submit = async () => {
    setBusy(true);
    try {
      if (reject) await api.admin.decideVerification(v.id, "rejected", note.trim());
      else await api.admin.setVendorActive(v.id, false, note.trim());
      toast.success(reject ? `${v.business_name} rejected — they've been emailed the reason` : `${v.business_name} suspended`);
      refresh();
      onClose();
    } catch (e) {
      toast.error(errorText(e, "Couldn't save"));
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {reject ? (v.verification_status === "approved" ? "Revoke verification" : "Reject vendor") : "Suspend vendor"}
          </DialogTitle>
          <DialogDescription>
            {reject
              ? `${v.business_name} won't appear in search or be bookable. The reason below is emailed to them so they can fix it and reapply.`
              : `${v.business_name} is hidden from search and can't take new bookings. Existing bookings carry on as normal.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="vendor-note">{reject ? "Reason (sent to the vendor)" : "Reason (sent to the vendor)"}</Label>
          <Textarea
            id="vendor-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={reject ? "e.g. Your RC number is registered to a different business name. Please check and update it." : "e.g. Multiple customers reported no-shows. We're reviewing your account."}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={busy || note.trim().length < 5}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {reject ? "Reject" : "Suspend"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminDashboard;
