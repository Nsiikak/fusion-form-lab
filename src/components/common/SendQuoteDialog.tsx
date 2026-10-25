import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TimePicker from "@/components/common/TimePicker";
import { api } from "@/lib/api";
import { NIGERIAN_STATES } from "@/lib/categories";
import { formatNaira } from "@/lib/utils";

type Line = { name: string; quantity: string; unit_price: string };

/** Vendor: turn an agreed price into a payable quote, sent into the chat. */
const SendQuoteDialog = ({ open, onClose, conversationId, onSent }: { open: boolean; onClose: () => void; conversationId: number; onSent: () => void }) => {
  const [lines, setLines] = useState<Line[]>([{ name: "", quantity: "1", unit_price: "" }]);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState(""); const [city, setCity] = useState(""); const [state, setState] = useState("");
  const [note, setNote] = useState("");
  const [logistics, setLogistics] = useState(true);
  const [days, setDays] = useState("3");
  const [busy, setBusy] = useState(false);
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);
  const valid = !!date && lines.every((l) => l.name.trim() && Number(l.quantity) >= 1 && Number(l.unit_price) > 0);
  const set = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const submit = async () => {
    if (!date) return;
    setBusy(true);
    try {
      const at = new Date(date); if (time) { const [h, m] = time.split(":").map(Number); at.setHours(h, m, 0, 0); } else at.setHours(12, 0, 0, 0);
      await api.messages.sendQuote(conversationId, {
        items: lines.map((l) => ({ name: l.name.trim(), quantity: Number(l.quantity), unit_price: Number(l.unit_price) })),
        event_date: at.toISOString(), event_time: time ? `${time}:00` : undefined,
        event_address: venue || city || state ? { venue_name: venue || undefined, city: city || undefined, state: state || undefined } : undefined,
        note: note.trim() || undefined, include_logistics: logistics, valid_days: Number(days),
      });
      toast.success("Quote sent. The customer can accept and pay from the chat.");
      onSent(); onClose();
      setLines([{ name: "", quantity: "1", unit_price: "" }]); setNote("");
    } catch (e: any) {
      const d = e?.response?.data?.detail; toast.error(typeof d === "string" ? d : "Couldn't send the quote.");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send a quote</DialogTitle>
          <DialogDescription>Put the price you agreed into a quote. The customer pays it like any booking and the money is held until the event is done.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_56px_104px_32px] gap-2 items-center">
              <Input placeholder="What you'll provide" value={l.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="Item" />
              <Input inputMode="numeric" value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value.replace(/\D/g, "") })} aria-label="Quantity" />
              <Input inputMode="numeric" placeholder="₦ each" value={l.unit_price} onChange={(e) => set(i, { unit_price: e.target.value.replace(/[^\d.]/g, "") })} aria-label="Price each" />
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={lines.length === 1} aria-label="Remove" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, { name: "", quantity: "1", unit_price: "" }])}><Plus className="h-4 w-4 mr-1" /> Another item</Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-11 justify-start rounded-xl font-normal"><CalendarIcon className="h-4 w-4 mr-2" />{date ? format(date, "EEE d MMM yyyy") : "Event date"}</Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={date} onSelect={setDate} disabled={(d) => d <= new Date()} initialFocus /></PopoverContent>
          </Popover>
          <TimePicker value={time} onChange={setTime} placeholder="Start time" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
          <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <select value={state} onChange={(e) => setState(e.target.value)} className="h-10 rounded-md border border-input bg-white px-2 text-sm" aria-label="State">
            <option value="">State</option>{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={logistics} onChange={(e) => setLogistics(e.target.checked)} /> Add my logistics fee for this location</label>
        <Textarea rows={2} placeholder="Note for the customer (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex items-center justify-between text-sm">
          <span>Items: <b>{formatNaira(total)}</b> <span className="text-muted-foreground">+ logistics and 2.5% platform fee</span></span>
          <label className="flex items-center gap-1.5 text-muted-foreground">Valid for
            <select value={days} onChange={(e) => setDays(e.target.value)} className="h-8 rounded-md border border-input bg-white px-1.5 text-sm">
              {["1", "2", "3", "5", "7", "14"].map((d) => <option key={d} value={d}>{d} day{d === "1" ? "" : "s"}</option>)}
            </select>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !valid}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Send quote</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SendQuoteDialog;
