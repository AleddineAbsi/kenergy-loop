import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, Loader2, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { analyzeRoomScan } from "@/lib/scan.functions";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan a room — Kenergy" },
      { name: "description", content: "Upload a photo of any room — our AI identifies appliances, heating, and standby loads in seconds." },
    ],
  }),
  component: ScanPage,
});

function ScanPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const analyze = useServerFn(analyzeRoomScan);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");

  function onFile(f: File) {
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Image too large (max 10 MB).");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function run() {
    if (!file) return;
    if (!user) {
      toast.error("Sign in to run an AI scan.");
      navigate({ to: "/login" });
      return;
    }
    setBusy(true);
    try {
      setStage("Uploading photo…");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage
        .from("room-scans")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;

      setStage("AI analyzing the room…");
      const result = await analyze({ data: { image_path: path } });
      navigate({ to: "/scan/result", search: { id: result.id } });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
          <Sparkles className="h-3 w-3" /> AI-powered vision
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Scan a room</h1>
        <p className="mt-2 text-muted-foreground">
          One clear photo of the room you spend the most time in. Our AI identifies appliances, heating points, and standby loads — then folds those signals into your action plan.
        </p>

        {!user && !authLoading && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm">
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>{" "}
            to upload and analyze rooms. We store photos privately — only you can see them.
          </div>
        )}

        <label className="mt-8 block cursor-pointer rounded-3xl border-2 border-dashed border-border bg-card p-10 text-center transition-colors hover:border-primary hover:bg-primary/5">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          {preview ? (
            <img src={preview} alt="Room preview" className="mx-auto max-h-80 rounded-xl object-cover" />
          ) : (
            <div>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                <Upload className="h-6 w-6" />
              </span>
              <div className="mt-4 font-medium">Drop a photo or click to upload</div>
              <div className="mt-1 text-xs text-muted-foreground">JPG / PNG up to 10 MB</div>
            </div>
          )}
        </label>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {stage || "Photos stay private and are never shared."}
          </p>
          <button
            type="button"
            disabled={!file || busy || !user}
            onClick={run}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Working…" : "Analyze with AI"}
          </button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
