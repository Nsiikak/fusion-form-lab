import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { EscalationRow } from "@/pages/SupportDashboard";

const err = (e: any, f: string) => (typeof e?.response?.data?.detail === "string" ? e.response.data.detail : f);

/** Admin: support escalations to decide, support staff accounts, and the data-retention periods. */
const TeamPanel = () => {
  const queryClient = useQueryClient();
  const { data: escalations = [] } = useQuery({ queryKey: ["admin", "escalations"], queryFn: () => api.admin.escalations() });
  const { data: staff = [] } = useQuery({ queryKey: ["admin", "support-users"], queryFn: api.admin.supportUsers });
  const { data: retention = [] } = useQuery({ queryKey: ["admin", "retention"], queryFn: api.admin.retention });
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [email, setEmail] = useState(""); const [name, setName] = useState(""); const [busy, setBusy] = useState(false);

  const resolve = async (id: number) => {
    try { await api.admin.resolveEscalation(id, (notes[id] || "").trim()); queryClient.invalidateQueries({ queryKey: ["admin", "escalations"] }); }
    catch (e) { toast.error(err(e, "Couldn't resolve.")); }
  };
  const add = async () => {
    setBusy(true);
    try { await api.admin.createSupportUser(email.trim(), name.trim()); toast.success("Account created. They've been emailed a link to set their password.");
      setEmail(""); setName(""); queryClient.invalidateQueries({ queryKey: ["admin", "support-users"] }); }
    catch (e) { toast.error(err(e, "Couldn't create the account.")); } finally { setBusy(false); }
  };
  const deactivate = async (id: number) => {
    try { await api.admin.deactivateSupportUser(id); queryClient.invalidateQueries({ queryKey: ["admin", "support-users"] }); }
    catch (e) { toast.error(err(e, "Couldn't deactivate.")); }
  };
  const open = escalations.filter((e: any) => e.status === "open");

  return (
    <div className="space-y-6">
      <Card className="p-5 bg-white border-border">
        <h3 className="font-semibold mb-1">Escalations from support ({open.length} open)</h3>
        <p className="text-xs text-muted-foreground mb-3">Make the decision in Cases (refund, release, approve), then record what you did here so support can tell the customer.</p>
        <div className="space-y-2">
          {escalations.length === 0 && <p className="text-sm text-muted-foreground">No escalations.</p>}
          {escalations.map((e: any) => (
            <EscalationRow key={e.id} e={e}>
              {e.status === "open" && (
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                  <Textarea rows={2} className="flex-1" placeholder="What you decided (support sees this)" value={notes[e.id] || ""}
                    onChange={(ev) => setNotes((n) => ({ ...n, [e.id]: ev.target.value }))} />
                  <Button size="sm" disabled={(notes[e.id] || "").trim().length < 2} onClick={() => resolve(e.id)}>Mark resolved</Button>
                </div>
              )}
            </EscalationRow>
          ))}
        </div>
      </Card>

      <Card className="p-5 bg-white border-border">
        <h3 className="font-semibold mb-1">Support team</h3>
        <p className="text-xs text-muted-foreground mb-3">Support staff can look up bookings, read conversations with a logged reason, nudge vendors, resend emails, add notes and escalate. They can't refund, release, approve payouts or change vendors.</p>
        <div className="flex flex-col sm:flex-row gap-2 max-w-2xl">
          <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={add} disabled={busy || !email.includes("@") || name.trim().length < 2}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />} Add</Button>
        </div>
        <ul className="mt-3 divide-y divide-border">
          {staff.map((u: any) => (
            <li key={u.id} className="py-2 flex items-center justify-between text-sm">
              <span>{u.full_name} <span className="text-muted-foreground">({u.email})</span>{!u.is_active && <span className="ml-2 text-xs text-muted-foreground">deactivated</span>}</span>
              {u.is_active && <Button size="sm" variant="ghost" onClick={() => deactivate(u.id)}>Deactivate</Button>}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 bg-white border-border">
        <h3 className="font-semibold mb-1">Data retention</h3>
        <p className="text-xs text-muted-foreground mb-3">Cleaned up automatically once a day. Bookings, receipts and payout statements are never deleted. Change a period with its environment variable.</p>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1.5">Data</th><th>Kept for</th><th>Setting</th></tr></thead>
          <tbody>{retention.map((r: any) => (
            <tr key={r.data} className="border-t border-border/60"><td className="py-2">{r.data.replace(/_/g, " ")}</td><td>{r.days} days</td><td className="font-mono text-xs">{r.env}</td></tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
};

export default TeamPanel;
