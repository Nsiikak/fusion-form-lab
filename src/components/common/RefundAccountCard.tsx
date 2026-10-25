import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Landmark, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { NIGERIAN_BANKS } from "@/lib/banks";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/common/ConfirmDialog";

const GROUPS = Array.from(new Set(NIGERIAN_BANKS.map((b) => b.group)));

interface Props {
  /** A refund is waiting for this account — show it prominently. */
  urgent?: boolean;
  className?: string;
}

/** Optional bank account for refunds Paystack can't return to the original payment method
 *  (mostly bank-transfer/USSD payments). Card payments are always refunded to the card. */
export const RefundAccountCard = ({ urgent = false, className }: Props) => {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ["refund-account"], queryFn: api.account.getRefundAccount });
  const account = data?.refund_account;

  const [editing, setEditing] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (urgent && !account && !isLoading) setEditing(true);
  }, [urgent, account, isLoading]);

  const save = async () => {
    const bank = NIGERIAN_BANKS.find((b) => b.code === bankCode);
    if (!bank || accountNumber.length !== 10) return;
    setSaving(true);
    try {
      const res = await api.account.saveRefundAccount({ bank_code: bank.code, bank_name: bank.name, account_number: accountNumber });
      queryClient.setQueryData(["refund-account"], { refund_account: res.refund_account });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setEditing(false);
      setAccountNumber("");
      if (res.refunds_resumed > 0) toast.success("Saved — your refund is on its way to this account.");
      else toast.success(`Saved: ${res.refund_account.account_name}`);
      if (!res.name_matches) {
        toast.warning("This account name doesn't seem to match your name. Refunds must go to an account in your name.");
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "We couldn't verify that account. Check the bank and number.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: "Remove refund account?",
      description: "Card payments are still refunded to your card automatically.",
      confirmText: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    await api.account.deleteRefundAccount();
    queryClient.setQueryData(["refund-account"], { refund_account: null });
    toast.success("Refund account removed");
  };

  return (
    <Card className={cn("bg-white border p-4 sm:p-5 rounded-2xl", urgent ? "border-amber-300 ring-2 ring-amber-100" : "border-border", className)}>
      <div className="flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", urgent ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary")}>
          {urgent ? <AlertTriangle className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground">Refund account</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {urgent
              ? "A refund is waiting. Your bank didn't share the account you paid from, so add one here and we'll send it right away."
              : "Optional. Refunds normally go back to the card or account you paid with. We only use this if your bank can't receive it automatically."}
          </p>
        </div>
      </div>

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-4" />
      ) : account && !editing ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-muted/40 border border-border px-3.5 py-3">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{account.account_name}</p>
            <p className="text-xs text-muted-foreground">{account.bank_name} · {account.account_number_masked}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditing(true)} aria-label="Change refund account">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={remove} aria-label="Remove refund account">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : editing ? (
        <div className="mt-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-2.5">
            <select
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="Bank"
            >
              <option value="">Select bank</option>
              {GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {NIGERIAN_BANKS.filter((b) => b.group === g).map((b) => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <Input
              inputMode="numeric"
              placeholder="10-digit account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="h-11 rounded-xl bg-white"
              aria-label="Account number"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">It must be an account in your name. We check the name with your bank before saving.</p>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || !bankCode || accountNumber.length !== 10} className="h-10 rounded-xl">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Verifying…</> : "Verify & save"}
            </Button>
            {(account || !urgent) && (
              <Button variant="ghost" className="h-10 rounded-xl" onClick={() => { setEditing(false); setAccountNumber(""); }}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Button variant="outline" className="mt-4 h-10 rounded-xl" onClick={() => setEditing(true)}>
          Add refund account
        </Button>
      )}
    </Card>
  );
};

export default RefundAccountCard;
