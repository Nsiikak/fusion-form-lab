import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Banknote, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { api, AdminWithdrawal, WithdrawalStatus } from "@/lib/api";
import { formatNaira } from "@/lib/utils";
import { useConfirm } from "@/components/common/ConfirmDialog";

const err = (e: any, f: string) => (typeof e?.response?.data?.detail === "string" ? e.response.data.detail : f);
const when = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy, HH:mm") : "—");

const STATUS: Record<WithdrawalStatus, { label: string; tone: string }> = {
  awaiting_approval: { label: "Needs approval", tone: "bg-violet-500/10 text-violet-700 border-violet-200" },
  processing: { label: "Sending", tone: "bg-sky-500/10 text-sky-700 border-sky-200" },
  awaiting_otp: { label: "Waiting for Paystack OTP", tone: "bg-sky-500/10 text-sky-700 border-sky-200" },
  paid: { label: "Paid", tone: "bg-green-500/10 text-green-700 border-green-200" },
  failed: { label: "Failed · back in wallet", tone: "bg-amber-500/10 text-amber-800 border-amber-200" },
};

/** Admin: vendor withdrawals. Large ones wait here for approval; the rest go out automatically. */
const WithdrawalsPanel = () => {
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin", "withdrawals"], queryFn: () => api.admin.withdrawals() });
  const waiting = rows.filter((w) => w.status === "awaiting_approval" || w.status === "awaiting_otp");
  const rest = rows.filter((w) => !waiting.includes(w));

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin mx-auto my-12 text-muted-foreground" />;
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Vendors' earnings go into their Plagohive wallet when a booking settles. They withdraw to their bank whenever
        they like; withdrawals above the approval limit wait here for you. A failed transfer returns the money to the
        vendor's wallet automatically.
      </p>
      {waiting.length === 0 ? (
        <Card className="p-10 text-center bg-white border-dashed">
          <CheckCircle2 className="h-10 w-10 mx-auto text-green-600 mb-3" />
          <p className="font-semibold">No withdrawals need you</p>
        </Card>
      ) : (
        <div className="space-y-3">{waiting.map((w) => <WithdrawalRow key={w.id} w={w} />)}</div>
      )}
      {rest.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Recent withdrawals</h3>
          <div className="space-y-2">{rest.map((w) => <WithdrawalRow key={w.id} w={w} />)}</div>
        </div>
      )}
    </div>
  );
};

const WithdrawalRow = ({ w }: { w: AdminWithdrawal }) => {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const run = async (fn: () => Promise<AdminWithdrawal>, done: (r: AdminWithdrawal) => void, fallback: string) => {
    setBusy(true);
    try { done(await fn()); refresh(); } catch (e) { toast.error(err(e, fallback)); } finally { setBusy(false); }
  };
  const approve = async () => {
    const ok = await confirm({
      title: `Send ${formatNaira(w.amount)} to ${w.vendor_name || "the vendor"}?`,
      description: "The transfer goes from your Paystack balance to the vendor's verified bank account. This can't be undone.",
      confirmText: "Approve & send",
      cancelText: "Not yet",
    });
    if (ok) run(() => api.admin.approveWithdrawal(w.id), (r) =>
      r.status === "failed" ? toast.error(`Paystack refused it: ${r.error || "unknown error"}. The money is back in the vendor's wallet.`)
        : toast.success("Approved and sent to Paystack"), "Couldn't approve");
  };
  const reject = () => run(() => api.admin.rejectWithdrawal(w.id, reason.trim()), () => toast.success("Rejected. The money is back in the vendor's wallet."), "Couldn't reject");
  const check = () => run(() => api.admin.syncWithdrawal(w.id), (r) =>
    r.status === "paid" ? toast.success("Paystack confirms it was paid")
      : r.status === "failed" ? toast.error("Paystack reports it failed. The money is back in the vendor's wallet.")
        : toast.info("Paystack is still processing it"), "Couldn't reach Paystack");

  const meta = STATUS[w.status];
  return (
    <Card className="bg-white border border-border p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Banknote className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{formatNaira(w.amount)}</span>
            <span className="text-sm text-muted-foreground truncate">to {w.vendor_name || `vendor #${w.vendor_id}`}</span>
            <Badge variant="outline" className={meta.tone}>{meta.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="font-mono">{w.reference}</span> · requested {when(w.created_at)}
            {w.paid_at && <> · paid {when(w.paid_at)}</>}
            {w.status === "awaiting_approval" && <> · wallet after this: {formatNaira(w.wallet_balance)}</>}
          </p>
          {w.error && (w.status === "failed" || w.status === "awaiting_otp") && (
            <p className="text-xs bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mt-2"><b>Paystack:</b> {w.error}</p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {w.status === "awaiting_approval" && !rejecting && (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
                <XCircle className="h-4 w-4 mr-1.5" /> Reject
              </Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={busy} onClick={approve}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Banknote className="h-4 w-4 mr-1.5" />} Approve
              </Button>
            </>
          )}
          {(w.status === "processing" || w.status === "awaiting_otp") && (
            <Button size="sm" variant="outline" disabled={busy} onClick={check}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />} Check with Paystack
            </Button>
          )}
        </div>
      </div>
      {rejecting && (
        <div className="mt-3 space-y-2">
          <Textarea placeholder="Reason (shown to the vendor)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={busy || reason.trim().length < 3} onClick={reject}>Reject withdrawal</Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default WithdrawalsPanel;
