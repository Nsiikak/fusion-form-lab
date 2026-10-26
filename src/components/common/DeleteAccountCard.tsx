import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

/** Self-service account deletion. The account is hidden at once and erased after a grace period;
 *  signing in again before then restores it. */
export const DeleteAccountCard = ({ className }: Props) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const submit = async () => {
    if (!password) return;
    setDeleting(true);
    try {
      const res = await api.account.requestDeletion(password);
      const when = new Date(res.delete_on).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
      logout();
      navigate("/");
      toast.success(`Your account will be deleted on ${when}. Sign in before then if you change your mind.`, { duration: 10000 });
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "We couldn't delete your account. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <Card className={cn("bg-white border border-border p-4 sm:p-5 rounded-2xl", className)}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-destructive/10 text-destructive">
          <Trash2 className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground">Delete account</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Your account is hidden straight away and permanently deleted after 30 days. Sign in before then to keep it.
            Booking and payment records are kept without your personal details, as the law requires.
          </p>
        </div>
      </div>

      {open ? (
        <div className="mt-4 space-y-3">
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password to confirm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="h-11 rounded-xl bg-white"
            aria-label="Password"
          />
          <div className="flex gap-2">
            <Button variant="destructive" onClick={submit} disabled={deleting || !password} className="h-10 rounded-xl">
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Deleting…</> : "Delete my account"}
            </Button>
            <Button variant="ghost" className="h-10 rounded-xl" onClick={() => { setOpen(false); setPassword(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="mt-4 h-10 rounded-xl text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      )}
    </Card>
  );
};

export default DeleteAccountCard;
