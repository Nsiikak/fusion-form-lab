import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, BellRing, Loader2, LogOut, Mail, Search, Send, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConversationViewer from "@/components/admin/ConversationViewer";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { cn, formatNaira } from "@/lib/utils";

const err = (e: any, f: string) => (typeof e?.response?.data?.detail === "string" ? e.response.data.detail : f);
const when = (iso?: string | null) => (iso ? format(new Date(iso), "d MMM yyyy, HH:mm") : "");
const CASE_LABEL: Record<string, string> = {
  dispute: "Dispute", refund_review: "Refund review", payout_approval: "Payout approval", awaiting_otp: "Awaiting OTP",
  failed_payout: "Failed payout", failed_refund: "Failed refund", refund_needs_details: "Refund needs bank details",
};

/** Support team workspace: look up, help, nudge, resend, note and escalate. Decisions stay with admins. */
const SupportDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/Plagohive.svg" alt="Plagohive" className="w-auto object-contain h-7 sm:h-8" />
            <span className="text-xs font-bold uppercase tracking-wider rounded-full bg-celebrate-emerald/15 text-celebrate-emerald px-2.5 py-1">Support</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => { logout(); navigate("/"); }}><LogOut className="h-4 w-4 mr-1" /> Sign out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <h1 className="text-3xl font-bold">Support</h1>
        <p className="text-muted-foreground mt-1">Help customers and vendors, and escalate anything that needs a decision. Refunds, releases, payouts and vendor suspensions are decided by admins.</p>
        <Tabs defaultValue="lookup" className="mt-6">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="lookup">Look up</TabsTrigger>
            <TabsTrigger value="cases">Cases</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="emails">Emails</TabsTrigger>
            <TabsTrigger value="escalations">My escalations</TabsTrigger>
          </TabsList>
          <TabsContent value="lookup"><Lookup /></TabsContent>
          <TabsContent value="cases"><Cases /></TabsContent>
          <TabsContent value="upcoming"><Upcoming /></TabsContent>
          <TabsContent value="emails"><Emails /></TabsContent>
          <TabsContent value="escalations"><MyEscalations /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

const Lookup = () => {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const { data, isFetching } = useQuery({ queryKey: ["support", "lookup", term], queryFn: () => api.support.lookup(term), enabled: term.length > 0 });
  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }} className="flex gap-2 max-w-xl">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Booking number, payment reference, receipt number, email or phone" />
        <Button type="submit"><Search className="h-4 w-4 mr-1" /> Find</Button>
      </form>
      {isFetching && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {data && data.length === 0 && <p className="text-sm text-muted-foreground">No bookings found.</p>}
      <div className="space-y-3">{(data || []).map((b: any) => <BookingCard key={b.id} b={b} />)}</div>
    </div>
  );
};

const Cases = () => {
  const { data = [], isLoading } = useQuery({ queryKey: ["support", "cases"], queryFn: api.support.cases });
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (!data.length) return <p className="text-sm text-muted-foreground">No open cases.</p>;
  return <div className="space-y-3">{data.map((b: any) => <BookingCard key={b.id} b={b} />)}</div>;
};

const BookingCard = ({ b }: { b: any }) => {
  const queryClient = useQueryClient();
  const [noteOpen, setNoteOpen] = useState(false);
  const [escOpen, setEscOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const nudge = async () => {
    setBusy(true);
    try { const r = await api.support.nudgeVendor(b.id); toast.success(`Vendor reminded to ${r.action}.`); }
    catch (e) { toast.error(err(e, "Couldn't send the reminder.")); } finally { setBusy(false); }
  };
  return (
    <Card className="p-4 bg-white border-border">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">Booking #{b.id} <span className="text-xs font-normal text-muted-foreground">· {b.status?.replace(/_/g, " ")}</span>
            {b.case_type && <span className="ml-2 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">{CASE_LABEL[b.case_type] || b.case_type}</span>}
          </p>
          <p className="text-sm text-muted-foreground">{b.event_date ? format(new Date(b.event_date), "EEE d MMM yyyy") : ""} · {formatNaira(b.customer_total ?? b.price)}
            {b.respond_by && <> · vendor must respond by {when(b.respond_by)}</>}</p>
        </div>
        <ConversationViewer bookingId={b.id} support />
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
        <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium">{b.customer_contact?.name}</p>
          <p className="text-muted-foreground">{b.customer_contact?.email} · {b.customer_contact?.phone || "no phone"}</p></div>
        <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Vendor</p><p className="font-medium">{b.vendor_contact?.name}</p>
          <p className="text-muted-foreground">{b.vendor_contact?.email} · {b.vendor_contact?.phone || "no phone"}</p></div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">Payment {b.paid_at ? `received ${when(b.paid_at)}` : "not received"} · refund: {b.refund_status || "none"} · payout: {b.payout_status || "not started"}
        {b.reconfirmed_at && " · reconfirmed"}{b.checked_in_at && " · checked in"}</p>
      <div className="flex flex-wrap gap-2 mt-3">
        {["pending", "confirmed"].includes(b.status) && <Button size="sm" variant="outline" disabled={busy} onClick={nudge}><BellRing className="h-4 w-4 mr-1" /> Nudge vendor</Button>}
        <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}><StickyNote className="h-4 w-4 mr-1" /> Notes</Button>
        <Button size="sm" onClick={() => setEscOpen(true)}><AlertTriangle className="h-4 w-4 mr-1" /> Escalate to admin</Button>
      </div>
      <NotesDialog open={noteOpen} onClose={() => setNoteOpen(false)} bookingId={b.id} />
      <EscalateDialog open={escOpen} onClose={() => setEscOpen(false)} bookingId={b.id} onDone={() => queryClient.invalidateQueries({ queryKey: ["support", "escalations"] })} />
    </Card>
  );
};

const NotesDialog = ({ open, onClose, bookingId }: { open: boolean; onClose: () => void; bookingId: number }) => {
  const queryClient = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["support", "notes", bookingId], queryFn: () => api.support.notes(bookingId), enabled: open });
  const [text, setText] = useState("");
  const add = async () => {
    try { await api.support.addNote(bookingId, text.trim()); setText(""); queryClient.invalidateQueries({ queryKey: ["support", "notes", bookingId] }); }
    catch (e) { toast.error(err(e, "Couldn't save the note.")); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg rounded-2xl">
        <DialogHeader><DialogTitle>Internal notes · booking #{bookingId}</DialogTitle>
          <DialogDescription>Only the support team and admins see these.</DialogDescription></DialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {data.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
          {data.map((n: any) => <div key={n.id} className="rounded-lg border border-border p-2.5 text-sm"><p>{n.note}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{n.author} · {when(n.at)}</p></div>)}
        </div>
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What happened, what you told them, what's next" />
        <DialogFooter><Button onClick={add} disabled={text.trim().length < 2}>Add note</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EscalateDialog = ({ open, onClose, bookingId, onDone }: { open: boolean; onClose: () => void; bookingId: number; onDone: () => void }) => {
  const [category, setCategory] = useState("refund");
  const [priority, setPriority] = useState("normal");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.support.escalate({ booking_id: bookingId, category, priority, note: note.trim() });
      toast.success("Escalated. An admin has been alerted."); onDone(); onClose(); setNote("");
    } catch (e) { toast.error(err(e, "Couldn't escalate.")); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg rounded-2xl">
        <DialogHeader><DialogTitle>Escalate booking #{bookingId}</DialogTitle>
          <DialogDescription>For anything that needs a decision: refunds, releasing payment, payouts, vendor suspensions, fraud.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-medium">What's needed
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-white px-2 text-sm">
              <option value="refund">Refund decision</option><option value="release">Release payment</option><option value="payout">Payout problem</option>
              <option value="vendor">Vendor behaviour</option><option value="fraud">Possible fraud</option><option value="other">Other</option>
            </select></label>
          <label className="text-sm font-medium">Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-white px-2 text-sm">
              <option value="normal">Normal</option><option value="urgent">Urgent (event soon or money at risk)</option>
            </select></label>
        </div>
        <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened, what the customer or vendor wants, and what you recommend" />
        <DialogFooter><Button onClick={submit} disabled={busy || note.trim().length < 10}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Escalate</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Upcoming = () => {
  const { data = [] } = useQuery({ queryKey: ["support", "upcoming"], queryFn: api.support.upcoming });
  if (!data.length) return <p className="text-sm text-muted-foreground">No events in the next 7 days.</p>;
  return (
    <div className="space-y-2">
      {data.map((e: any) => (
        <div key={e.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-3 text-sm">
          <span className={cn("h-2.5 w-2.5 rounded-full", e.health === "red" ? "bg-destructive" : e.health === "amber" ? "bg-amber-500" : "bg-celebrate-emerald")} />
          <span className="font-medium">#{e.id} · {e.vendor_name}</span>
          <span className="text-muted-foreground">{e.event_date ? format(new Date(e.event_date), "EEE d MMM, HH:mm") : ""}</span>
          <span className="text-muted-foreground">{e.note}</span>
        </div>
      ))}
    </div>
  );
};

const Emails = () => {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const queryClient = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["support", "notifications", term], queryFn: () => api.support.notifications(term) });
  const resend = async (ref: string) => {
    try { await api.support.resend(ref); toast.success("Email sent again."); queryClient.invalidateQueries({ queryKey: ["support", "notifications"] }); }
    catch (e) { toast.error(err(e, "Couldn't resend.")); }
  };
  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }} className="flex gap-2 max-w-md">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recipient email" />
        <Button type="submit" variant="outline"><Mail className="h-4 w-4 mr-1" /> Search</Button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1.5">When</th><th>To</th><th>Subject</th><th>Status</th><th /></tr></thead>
          <tbody>{data.map((n: any) => (
            <tr key={n.reference} className="border-t border-border/60">
              <td className="py-2 whitespace-nowrap">{when(n.at)}</td><td className="max-w-[160px] truncate">{n.recipient}</td>
              <td className="max-w-[240px] truncate">{n.resent_from && <span className="text-xs text-muted-foreground">(resent) </span>}{n.subject}</td>
              <td className={n.status === "sent" ? "text-green-700" : "text-destructive"} title={n.error || undefined}>{n.status}</td>
              <td className="text-right">{n.resendable && <Button size="sm" variant="ghost" onClick={() => resend(n.reference)}><Send className="h-3.5 w-3.5 mr-1" /> Resend</Button>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
};

const MyEscalations = () => {
  const { data = [] } = useQuery({ queryKey: ["support", "escalations"], queryFn: api.support.escalations });
  if (!data.length) return <p className="text-sm text-muted-foreground">You haven't escalated anything yet.</p>;
  return <div className="space-y-2">{data.map((e: any) => <EscalationRow key={e.id} e={e} />)}</div>;
};

export const EscalationRow = ({ e, children }: { e: any; children?: React.ReactNode }) => (
  <div className={cn("rounded-xl border p-3 text-sm bg-white", e.status === "open" && e.priority === "urgent" ? "border-destructive/50" : "border-border")}>
    <div className="flex flex-wrap justify-between gap-2">
      <span className="font-medium">#{e.id} · {e.category}{e.booking_id ? ` · booking #${e.booking_id}` : ""}
        {e.priority === "urgent" && <span className="ml-2 text-xs font-semibold text-destructive">URGENT</span>}</span>
      <span className={e.status === "open" ? "text-amber-700" : "text-green-700"}>{e.status}</span>
    </div>
    <p className="mt-1">{e.note}</p>
    <p className="text-[11px] text-muted-foreground mt-1">Raised by {e.raised_by} · {when(e.created_at)}</p>
    {e.resolution_note && <p className="mt-2 rounded-lg bg-muted/40 p-2 text-[13px]"><b>{e.resolved_by}:</b> {e.resolution_note}</p>}
    {children}
  </div>
);

export default SupportDashboard;
