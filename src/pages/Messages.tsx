import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, CalendarCheck, FileText, ImagePlus, Loader2, Lock, MessageCircle, Send, ShieldCheck, X } from "lucide-react";
import DashboardHeader from "@/components/common/DashboardHeader";
import QuoteCard from "@/components/common/QuoteCard";
import SendQuoteDialog from "@/components/common/SendQuoteDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { api, ChatAttachment, ChatMessage, ConversationSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const CONTACT_HINT = /(\+?234|0)[\s\-.]*[789][\s\-.]*[01](?:[\s\-.]*\d){8}|[\w.+-]+@[\w-]+\.[\w.-]+|wa\.me|whats\s*app/i;

const QUICK_REPLIES = [
  "Hi! Are you available on my event date?",
  "What's included in your price?",
  "Do you cover my area?",
  "Could you share more photos of your work?",
];

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEE d MMM");
};
const timeLabel = (iso: string | null) => (iso ? format(new Date(iso), "HH:mm") : "");
const fullTime = (iso: string | null) => (iso ? format(new Date(iso), "EEEE d MMMM yyyy, HH:mm:ss") : "");
const listTime = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isToday(d) ? format(d, "HH:mm") : isYesterday(d) ? "Yesterday" : format(d, "d MMM");
};

const Avatar = ({ name, image, size = 44 }: { name: string; image?: string | null; size?: number }) =>
  image ? (
    <img src={image} alt="" className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span
      className="rounded-full bg-[hsl(var(--primary-light))] text-[hsl(var(--primary-deep))] font-semibold flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name?.trim()?.[0]?.toUpperCase() || "?"}
    </span>
  );

// ─────────────────────────────────────────────────────────────────────────────

const Messages = () => {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const activeId = id ? Number(id) : null;

  // /messages?vendor=12 → open (or create) the chat with that vendor
  useEffect(() => {
    const vendorId = search.get("vendor");
    if (!vendorId) return;
    api.messages
      .start(Number(vendorId))
      .then((c) => navigate(`/messages/${c.id}`, { replace: true }))
      .catch(() => {
        toast.error("Couldn't open this chat. Please try again.");
        navigate("/messages", { replace: true });
      });
  }, [search, navigate]);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["messages", "conversations"],
    queryFn: api.messages.conversations,
    refetchInterval: 15_000,
  });

  const links =
    user?.role === "vendor"
      ? [{ to: "/vendor-dashboard", label: "Dashboard" }, { to: "/messages", label: "Messages" }, { to: "/profile", label: "Profile" }]
      : [{ to: "/vendor-search", label: "Find Vendors" }, { to: "/customer-dashboard", label: "Dashboard" }, { to: "/messages", label: "Messages" }];

  return (
    <div className="min-h-[100dvh] bg-background">
      <DashboardHeader
        links={links}
        displayName={user?.full_name || user?.email || "Account"}
        subtitle={user?.email}
        onLogout={() => { logout(); navigate("/"); }}
      />
      <main className="pt-16 h-[100dvh] flex">
        <div className="mx-auto w-full max-w-6xl flex md:px-6 md:py-6 gap-6 min-h-0">
          {/* Inbox */}
          <aside className={cn("w-full md:w-[340px] flex-shrink-0 flex-col min-h-0 bg-white md:rounded-2xl md:border md:border-border", activeId ? "hidden md:flex" : "flex")}>
            <div className="px-5 pt-5 pb-3">
              <h1 className="font-display text-2xl font-bold">Messages</h1>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-celebrate-emerald" /> Chats on Plagohive keep your payment protected
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto my-10 text-muted-foreground" />
              ) : conversations.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <MessageCircle className="h-10 w-10 mx-auto text-primary/60" />
                  <p className="font-semibold mt-3">No conversations yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {user?.role === "vendor"
                      ? "When customers message you, their questions will appear here."
                      : "Found a vendor you like? Tap “Message” on their page to ask anything before you book."}
                  </p>
                  {user?.role !== "vendor" && (
                    <Button asChild className="mt-5 rounded-xl"><Link to="/vendor-search">Find vendors</Link></Button>
                  )}
                </div>
              ) : (
                <ul>
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/messages/${c.id}`}
                        className={cn(
                          "flex gap-3 px-5 py-3.5 border-t border-border/60 transition-colors",
                          c.id === activeId ? "bg-[hsl(var(--primary-pale))]" : "hover:bg-muted/50",
                        )}
                      >
                        <Avatar name={c.other.name} image={c.other.image} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className={cn("truncate", c.unread ? "font-bold" : "font-semibold")}>{c.other.name}</p>
                            <span className="text-[11px] text-muted-foreground flex-shrink-0">{listTime(c.last_message_at)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className={cn("text-sm truncate flex-1", c.unread ? "text-foreground" : "text-muted-foreground")}>
                              {c.last_message_preview || "Say hello 👋"}
                            </p>
                            {c.unread > 0 && (
                              <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
                                {c.unread}
                              </span>
                            )}
                          </div>
                          {c.booking && (
                            <p className="text-[11px] text-celebrate mt-0.5 flex items-center gap-1">
                              <CalendarCheck className="h-3 w-3" /> Booked · {format(new Date(c.booking.event_date), "d MMM")}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* Thread */}
          <section className={cn("flex-1 min-w-0 min-h-0 flex-col bg-white md:rounded-2xl md:border md:border-border overflow-hidden", activeId ? "flex" : "hidden md:flex")}>
            {activeId ? (
              <Thread key={activeId} id={activeId} role={user?.role === "vendor" ? "vendor" : "customer"} />
            ) : (
              <div className="m-auto text-center px-8">
                <MessageCircle className="h-12 w-12 mx-auto text-primary/40" />
                <p className="mt-3 text-muted-foreground">Choose a conversation to read it here.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

// ── One conversation ─────────────────────────────────────────────────────────

const Thread = ({ id, role }: { id: number; role: "customer" | "vendor" }) => {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [meta, setMeta] = useState<{ conversation: ConversationSummary; contact_allowed: boolean; other_last_read_id: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const lastId = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);

  // Load, then poll for new messages every 4s (and when the tab regains focus)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const t = await api.messages.thread(id, lastId.current);
        if (!alive) return;
        setMeta({ conversation: t.conversation, contact_allowed: t.contact_allowed, other_last_read_id: t.other_last_read_id });
        if (t.messages.length) {
          lastId.current = t.messages[t.messages.length - 1].id;
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            return [...prev, ...t.messages.filter((m) => !seen.has(m.id))];
          });
          queryClient.invalidateQueries({ queryKey: ["messages", "unread"] });
          queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
        }
      } catch {
        /* keep polling quietly */
      }
    };
    load();
    const timer = setInterval(load, 4000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [id, queryClient]);

  // Keep the view pinned to the newest message unless the user scrolled up to read
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Auto-grow the text box
  useLayoutEffect(() => {
    const t = textarea.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 140)}px`;
  }, [draft]);

  const send = async (text = draft) => {
    const body = text.trim();
    if ((!body && pending.length === 0) || sending) return;
    setSending(true);
    try {
      const msg = await api.messages.send(id, body, pending.length ? pending : undefined);
      stickToBottom.current = true;
      lastId.current = Math.max(lastId.current, msg.id);
      setMessages((prev) => [...prev, msg]);
      setDraft("");
      setPending([]);
      queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
      textarea.current?.focus();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Message not sent. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(Array.from(files).slice(0, 6 - pending.length).map((f) => api.messages.uploadPhoto(id, f)));
      setPending((p) => [...p, ...uploaded]);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Couldn't upload that photo. JPG, PNG or WebP under 5MB work best.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const showContactHint = !meta?.contact_allowed && CONTACT_HINT.test(draft);
  const other = meta?.conversation.other;
  const lastMineSeen = useMemo(() => {
    const mine = messages.filter((m) => m.mine);
    const last = mine[mine.length - 1];
    return last && meta && meta.other_last_read_id >= last.id ? last.id : null;
  }, [messages, meta]);

  return (
    <>
      {/* Thread header */}
      <div className="flex items-center gap-3 px-3 md:px-5 py-3 border-b border-border flex-shrink-0 bg-white">
        <Link to="/messages" className="md:hidden p-2 -ml-1 rounded-full hover:bg-muted" aria-label="Back to messages">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {other ? <Avatar name={other.name} image={other.image} size={40} /> : <span className="w-10 h-10 rounded-full bg-muted" />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{other?.name || "…"}</p>
          <p className="text-xs text-muted-foreground truncate">
            {meta?.conversation.booking
              ? `Booking #${meta.conversation.booking.id} · ${format(new Date(meta.conversation.booking.event_date), "EEE d MMM")}`
              : other?.subtitle}
          </p>
        </div>
        {role === "customer" && other && !meta?.conversation.booking && (
          <Button asChild size="sm" className="rounded-xl flex-shrink-0">
            <Link to={`/vendors/${other.vendor_id}?book=1`}>Book</Link>
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scroller} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 md:px-6 py-4 space-y-1.5 bg-[hsl(var(--background))]">
        {!meta?.contact_allowed && (
          <p className="mx-auto mb-3 max-w-md text-center text-[12px] text-muted-foreground flex items-start gap-1.5 justify-center">
            <Lock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            Phone numbers, emails and social handles aren't shared in chat. Once a vendor reconfirms a booking, you'll both see each other's numbers on the booking itself.
          </p>
        )}

        {messages.length === 0 && meta && role === "customer" && (
          <div className="mx-auto max-w-md pt-4">
            <p className="text-center text-sm text-muted-foreground mb-3">Not sure what to ask? Tap one to send it:</p>
            <div className="flex flex-col gap-2">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-left text-sm rounded-2xl border border-border bg-white px-4 py-3 hover:border-primary/40 hover:bg-[hsl(var(--primary-pale))] transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = m.created_at && (!prev?.created_at || dayLabel(prev.created_at) !== dayLabel(m.created_at));
          return (
            <div key={m.id}>
              {newDay && m.created_at && (
                <p className="text-center text-[11px] font-medium text-muted-foreground py-2">{dayLabel(m.created_at)}</p>
              )}
              {m.sender_role === "system" ? (
                <p className="mx-auto my-2 max-w-sm text-center text-[12px] rounded-xl bg-celebrate/10 text-celebrate px-3 py-2">
                  {m.body}
                  <time dateTime={m.created_at || undefined} title={fullTime(m.created_at)} className="block mt-0.5 text-[10.5px] opacity-70">{timeLabel(m.created_at)}</time>
                </p>
              ) : (
                <div className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "rounded-2xl px-3.5 py-2 shadow-sm",
                      m.attachments.some((x) => x.type === "quote") ? "w-full max-w-[420px]" : "max-w-[82%] md:max-w-[70%]",
                      m.mine ? "bg-navy text-navy-foreground rounded-br-md" : "bg-white text-foreground border border-border rounded-bl-md",
                    )}
                  >
                    {m.attachments.filter((a) => a.type === "quote").map((a) => (
                      <div key={`q${a.booking_id}`} className="mb-1.5 min-w-[240px]"><QuoteCard bookingId={a.booking_id as number} role={role} compact /></div>
                    ))}
                    {m.attachments.filter((a) => a.type !== "quote").length > 0 && (
                      <div className={cn("grid gap-1.5 mb-1.5", m.attachments.filter((a) => a.type !== "quote").length > 1 && "grid-cols-2")}>
                        {m.attachments.filter((a) => a.type !== "quote").map((a) => (
                          <a key={a.url} href={a.url} target="_blank" rel="noreferrer">
                            <img src={a.url} alt="Shared photo" loading="lazy" className="rounded-xl max-h-60 w-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                    {m.body && !m.attachments.some((a) => a.type === "quote") && <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>}
                    <p className={cn("text-[10.5px] mt-0.5 text-right", m.mine ? "text-navy-foreground/60" : "text-muted-foreground")}>
                      <time dateTime={m.created_at || undefined} title={fullTime(m.created_at)}>{timeLabel(m.created_at)}</time>
                      {m.id === lastMineSeen && " · Seen"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {role === "vendor" && (
        <SendQuoteDialog open={quoteOpen} onClose={() => setQuoteOpen(false)} conversationId={id}
          onSent={() => queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] })} />
      )}

      {/* Composer */}
      <div className="flex-shrink-0 border-t border-border bg-white px-3 md:px-5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {showContactHint && (
          <p className="mb-2 text-[12px] rounded-xl bg-amber-50 text-amber-800 px-3 py-2 flex gap-1.5">
            <Lock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            Contact details can't be sent in chat. You'll see each other's numbers on the booking once the vendor reconfirms.
          </p>
        )}
        {pending.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto">
            {pending.map((a) => (
              <div key={a.url} className="relative flex-shrink-0">
                <img src={a.url} alt="" className="h-16 w-16 rounded-xl object-cover border" />
                <button
                  onClick={() => setPending((p) => p.filter((x) => x.url !== a.url))}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-navy text-white flex items-center justify-center"
                  aria-label="Remove photo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          {role === "vendor" && (
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full flex-shrink-0 text-primary" onClick={() => setQuoteOpen(true)} aria-label="Send a quote" title="Send a quote">
              <FileText className="h-5 w-5" />
            </Button>
          )}
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full flex-shrink-0 text-muted-foreground"
            onClick={() => fileInput.current?.click()}
            disabled={uploading || pending.length >= 6}
            aria-label="Add photos"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          </Button>
          <label htmlFor="chat-input" className="sr-only">Message</label>
          <textarea
            id="chat-input"
            ref={textarea}
            rows={1}
            value={draft}
            maxLength={2000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends on desktop; on phones Enter adds a line and the button sends
              if (e.key === "Enter" && !e.shiftKey && !window.matchMedia("(pointer: coarse)").matches) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Write a message…"
            className="flex-1 resize-none rounded-2xl border border-input bg-muted/30 px-4 py-2.5 text-[15px] leading-relaxed outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 max-h-[140px]"
          />
          <Button
            size="icon"
            className="h-11 w-11 rounded-full flex-shrink-0"
            onClick={() => send()}
            disabled={sending || (!draft.trim() && pending.length === 0)}
            aria-label="Send"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </>
  );
};

export default Messages;
