import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Loader2, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, Withdrawal, WalletEntry } from "@/lib/api";
import { cn, formatNaira } from "@/lib/utils";
import { useConfirm } from "@/components/common/ConfirmDialog";

const KIND_LABEL: Record<WalletEntry["kind"], string> = {
  earning: "Earnings",
  advance: "Advance",
  withdrawal: "Withdrawal",
  withdrawal_reversal: "Withdrawal returned",
};

const WITHDRAWAL_TEXT: Record<Withdrawal["status"], string> = {
  awaiting_approval: "being reviewed — usually within 1 working day",
  processing: "on its way to your bank",
  awaiting_otp: "on its way to your bank",
  paid: "sent to your bank",
  failed: "didn't go through — the money is back in your wallet",
};

/** Vendor wallet: settled bookings are credited here; the vendor withdraws to their bank on request. */
export const WalletCard = ({ className }: { className?: string }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { data: wallet, isLoading } = useQuery({ queryKey: ["wallet"], queryFn: api.vendors.wallet, refetchInterval: 60_000 });
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const withdraw = async () => {
    if (!wallet) return;
    const value = amount ? Number(amount) : wallet.balance;
    const ok = await confirm({
      title: `Withdraw ${formatNaira(value)} to your bank?`,
      description: value > wallet.approval_threshold
        ? "Withdrawals this large are checked by our team first, usually within 1 working day."
        : "It's sent to the bank account in your Payout Settings straight away.",
      confirmText: "Withdraw",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await api.vendors.withdraw(amount ? value : undefined);
      queryClient.setQueryData(["wallet"], res.wallet);
      setAmount("");
      const s = res.withdrawal.status;
      if (s === "failed") toast.error("Your withdrawal didn't go through. The money is back in your wallet — please try again later.");
      else if (s === "awaiting_approval") toast.success("Withdrawal requested. Our team will review it shortly.");
      else toast.success(`${formatNaira(res.withdrawal.amount)} is on its way to your bank.`);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Couldn't start the withdrawal. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !wallet) {
    return <Card className={cn("bg-white border border-border p-5 rounded-2xl", className)}><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Card>;
  }
  const pending = wallet.pending_withdrawal;
  const tooMuch = amount !== "" && Number(amount) > wallet.balance;

  return (
    <Card className={cn("bg-white border border-border p-4 sm:p-6 rounded-2xl", className)}>
      <div className="flex flex-col lg:flex-row lg:items-start gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <WalletIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Wallet balance</p>
              <p className="text-2xl sm:text-3xl font-bold text-primary">{formatNaira(wallet.balance)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            Your share of each booking lands here once it's settled. Withdraw to your bank whenever you like.
          </p>
          {pending && (
            <p className="text-sm mt-3 rounded-xl bg-sky-50 border border-sky-200 px-3 py-2">
              Withdrawal of <b>{formatNaira(pending.amount)}</b> {WITHDRAWAL_TEXT[pending.status]}.
            </p>
          )}
        </div>

        <div className="lg:w-80 flex-shrink-0 space-y-2">
          {!wallet.has_bank_account ? (
            <Button className="w-full h-11 rounded-xl" variant="outline" onClick={() => navigate("/profile#payouts")}>
              Add bank account to withdraw
            </Button>
          ) : (
            <>
              <Input
                inputMode="decimal"
                placeholder={`Amount (default: all ${formatNaira(wallet.balance)})`}
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                className="h-11 rounded-xl bg-white"
                aria-label="Withdrawal amount"
                disabled={!wallet.can_withdraw}
              />
              <Button className="w-full h-11 rounded-xl" disabled={busy || !wallet.can_withdraw || tooMuch} onClick={withdraw}>
                {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending…</> : "Withdraw to bank"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                {pending ? "One withdrawal at a time." : `Minimum ${formatNaira(wallet.minimum)}.`}
              </p>
            </>
          )}
        </div>
      </div>

      {(wallet.entries.length > 0) && (
        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent activity</p>
          <div className="divide-y divide-border/70">
            {wallet.entries.slice(0, 6).map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2 text-sm">
                {e.amount >= 0
                  ? <ArrowDownLeft className="h-4 w-4 text-green-600 flex-shrink-0" />
                  : <ArrowUpRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                <span className="flex-1 min-w-0 truncate">
                  {KIND_LABEL[e.kind]}{e.booking_id ? ` · booking #${e.booking_id}` : ""}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {e.created_at ? format(new Date(e.created_at), "d MMM") : ""}
                </span>
                <span className={cn("font-semibold tabular-nums", e.amount >= 0 ? "text-green-700" : "text-foreground")}>
                  {e.amount >= 0 ? "+" : "−"}{formatNaira(Math.abs(e.amount))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default WalletCard;
