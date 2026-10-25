import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Flag, Mail, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const when = (iso?: string | null) => (iso ? format(new Date(iso), "d MMM yyyy, HH:mm") : "");

/** Admin audit: repeated contact-sharing attempts, who opened which chat and why, and every notification sent. */
const AuditPanel = () => {
  const flagged = useQuery({ queryKey: ["admin", "audit", "flagged"], queryFn: () => api.admin.auditFlagged() });
  const access = useQuery({ queryKey: ["admin", "audit", "access"], queryFn: () => api.admin.auditChatAccess() });
  const notes = useQuery({ queryKey: ["admin", "audit", "notifications"], queryFn: () => api.admin.auditNotifications() });

  return (
    <div className="space-y-6">
      <Card className="p-5 bg-white border-border">
        <h3 className="font-semibold flex items-center gap-2"><Flag className="h-4 w-4 text-destructive" /> Tried to share contact details (last 30 days)</h3>
        <p className="text-xs text-muted-foreground mb-3">These messages were blocked. Repeated attempts often mean someone is trying to take bookings off Plagohive.</p>
        {(flagged.data || []).length === 0 ? <p className="text-sm text-muted-foreground">No attempts.</p> : (
          <div className="space-y-3">
            {(flagged.data || []).map((u: any) => (
              <div key={u.user_id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span><b>{u.name}</b> <span className="text-muted-foreground">({u.role}, {u.email})</span></span>
                  <span className={cn("font-semibold", u.attempts >= 3 ? "text-destructive" : "text-foreground")}>{u.attempts} attempt{u.attempts === 1 ? "" : "s"}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {u.recent.map((a: any, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-2">
                      <time className="whitespace-nowrap">{when(a.at)}</time>
                      <span className="uppercase font-semibold">{a.kind}</span>
                      <span className="text-foreground break-all">"{a.body}"</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 bg-white border-border">
        <h3 className="font-semibold flex items-center gap-2 mb-3"><ScrollText className="h-4 w-4 text-primary" /> Chat access log</h3>
        {(access.data || []).length === 0 ? <p className="text-sm text-muted-foreground">No conversations opened yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1.5">When</th><th>Admin</th><th>Booking</th><th>Reason</th></tr></thead>
              <tbody>{(access.data || []).map((r: any) => (
                <tr key={r.id} className="border-t border-border/60"><td className="py-2 whitespace-nowrap">{when(r.at)}</td><td>{r.admin}</td><td>#{r.booking_id}</td><td>{r.reason}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5 bg-white border-border">
        <h3 className="font-semibold flex items-center gap-2 mb-3"><Mail className="h-4 w-4 text-primary" /> Notifications sent (latest 100)</h3>
        {(notes.data || []).length === 0 ? <p className="text-sm text-muted-foreground">Nothing sent yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[620px]">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1.5">When</th><th>Ref</th><th>Channel</th><th>To</th><th>Subject</th><th>Status</th><th /></tr></thead>
              <tbody>{(notes.data || []).map((n: any) => (
                <tr key={n.reference} className="border-t border-border/60">
                  <td className="py-2 whitespace-nowrap">{when(n.at)}</td><td className="font-mono text-xs">{n.reference}</td><td className="uppercase text-xs">{n.channel}</td>
                  <td className="max-w-[160px] truncate">{n.recipient}</td><td className="max-w-[220px] truncate">{n.subject}</td>
                  <td className={n.status === "sent" ? "text-green-700" : "text-destructive"} title={n.error || undefined}>{n.status}</td>
                  <td className="text-right">{n.channel === "email" && (
                    <Button size="sm" variant="ghost" onClick={async () => {
                      try { await api.support.resend(n.reference); toast.success("Email sent again."); notes.refetch(); }
                      catch (e: any) { toast.error(e?.response?.data?.detail || "Couldn't resend."); }
                    }}>Resend</Button>
                  )}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AuditPanel;
