import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, MessageSquareText, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const REASONS = ["Dispute review", "No-show report review", "Fraud or off-platform payment check", "Customer support request"];

/** Admin: read a booking's conversation, unmasked, only with a stated reason (every view is logged). */
const ConversationViewer = ({ bookingId, defaultReason, support = false }: { bookingId: number; defaultReason?: string; support?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(defaultReason || REASONS[0]);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const r = `${reason} (booking #${bookingId})`;
      setData(support ? await api.support.conversation(bookingId, r) : await api.admin.conversationBetween(bookingId, r));
    }
    catch (e: any) { toast.error(e?.response?.data?.detail?.toString?.() || "Couldn't load the conversation."); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setOpen(true); setData(null); }}>
        <MessageSquareText className="h-4 w-4 mr-1" /> View conversation
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Conversation for booking #{bookingId}</DialogTitle>
            <DialogDescription>Original, unmasked messages. Opening this is recorded with your account, the time and the reason.</DialogDescription>
          </DialogHeader>
          {!data ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium">Why are you opening this conversation?
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
                  {REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
              <p className="text-xs text-muted-foreground flex gap-1.5"><ShieldAlert className="h-4 w-4 flex-shrink-0" /> Only open conversations you need for this case.</p>
              <Button onClick={load} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Open conversation</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Customer: <b>{data.customer_name}</b> · Vendor: <b>{data.vendor_name}</b> · {data.messages?.length || 0} messages</p>
              {(data.messages || []).length === 0 && <p className="text-sm text-muted-foreground">These two haven't messaged each other.</p>}
              {(data.messages || []).map((m: any) => (
                <div key={m.id} className={cn("rounded-xl px-3 py-2 text-sm border",
                  m.sender_role === "system" ? "bg-celebrate/10 border-transparent text-center text-[13px]" : m.sender_role === "vendor" ? "bg-[hsl(var(--primary-pale))] border-[hsl(var(--primary-light))]" : "bg-white border-border")}>
                  <div className="flex justify-between gap-3 text-[11px] text-muted-foreground mb-0.5">
                    <span className="font-semibold uppercase tracking-wide">{m.sender_role}</span>
                    <time dateTime={m.created_at}>{m.created_at ? format(new Date(m.created_at), "EEE d MMM yyyy, HH:mm:ss") : ""}</time>
                  </div>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  {(m.attachments || []).filter((a: any) => a.url).map((a: any) => (
                    <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Photo attachment</a>
                  ))}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ConversationViewer;
