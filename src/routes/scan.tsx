import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Building2, Camera, Gauge, ImagePlus, Loader2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SiteFooter, SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { analyzeRoomScan } from "@/lib/scan.functions";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan a room - Kenergy Loop" },
      {
        name: "description",
        content: "Upload a room photo and get a visible energy footprint estimate for appliances, heating, AC, and standby loads.",
      },
    ],
  }),
  component: ScanPage,
});

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ScanPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const analyze = useServerFn(analyzeRoomScan);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("Choose a clear JPG, PNG, or WebP photo.");
  const [error, setError] = useState<string | null>(null);

  function chooseFile(nextFile: File) {
    setError(null);

    if (!ALLOWED_TYPES.includes(nextFile.type)) {
      const message = "Use a JPG, PNG, or WebP image.";
      setError(message);
      toast.error(message);
      return;
    }

    if (nextFile.size > MAX_IMAGE_BYTES) {
      const message = `Image is ${formatBytes(nextFile.size)}. Please use a photo under 10 MB.`;
      setError(message);
      toast.error(message);
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
    setStage("Ready to analyze.");
  }

  async function runScan() {
    if (!file) return;

    if (!user) {
      toast.error("Sign in to run the room scan.");
      navigate({ to: "/login" });
      return;
    }

    setBusy(true);
    setError(null);

    try {
      setStage("Uploading photo privately...");
      const ext = file.name.split(".").pop()?.toLowerCase() || (file.type === "image/png" ? "png" : "jpg");
      const imagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("room-scans")
        .upload(imagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setStage("Detecting machines, building clues, AC, and standby loads...");
      const result = await analyze({ data: { image_path: imagePath } });

      setStage("Opening your result...");
      navigate({ to: "/scan/result", search: { id: result.id } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Room scan failed.";
      console.error(err);
      setError(message);
      setStage("Scan failed. Fix the issue above and try again.");
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
        <section>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            <Sparkles className="h-3 w-3" />
            Room energy scan
          </div>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Scan a room</h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Upload one clear photo. Kenergy Loop looks for visible machines, heating, cooling, windows, standby loads,
            product clues, and then estimates rough yearly consumption with confidence levels.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <InsightStrip icon={Camera} label="Photo-first" value="Visible devices" />
            <InsightStrip icon={Gauge} label="Room metric" value="Energy percentile" />
            <InsightStrip icon={ShieldCheck} label="Confidence" value="Honest ranges" />
          </div>

          {!user && !authLoading && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm shadow-[var(--shadow-soft)]">
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>{" "}
              to save the scan result. Photos are stored privately in your Supabase project.
            </div>
          )}

          <div className="mt-7 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/10 p-4 shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-primary/35 hover:shadow-lg sm:p-5">
            <label
              className="group block cursor-pointer rounded-2xl border-2 border-dashed border-border bg-background/85 p-4 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-primary/5 sm:p-6"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const dropped = event.dataTransfer.files?.[0];
                if (dropped) chooseFile(dropped);
              }}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={busy}
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (selected) chooseFile(selected);
                }}
              />
              {preview ? (
                <img src={preview} alt="Selected room" className="mx-auto max-h-[420px] w-full rounded-xl object-cover" />
              ) : (
                <div className="py-12">
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
                    <ImagePlus className="h-6 w-6" />
                  </span>
                  <div className="mt-4 font-semibold">Drop a photo here or click to upload</div>
                  <div className="mt-1 text-xs text-muted-foreground">JPG, PNG, or WebP under 10 MB</div>
                </div>
              )}
            </label>

            {file && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                <span className="min-w-0 truncate">{file.name}</span>
                <span>{formatBytes(file.size)}</span>
              </div>
            )}

            {error && (
              <div className="mt-4 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {busy && <AnalyzingRoom stage={stage} />}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{stage}</p>
              <button
                type="button"
                disabled={!file || busy || !user}
                onClick={runScan}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {busy ? "Analyzing..." : "Analyze room"}
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <InfoCard
            icon={Zap}
            title="Detected machines"
            text="Screens, laptops, heaters, lights, chargers, kitchen devices, standby-heavy electronics, and cooling devices."
          />
          <InfoCard
            icon={Building2}
            title="Building clues"
            text="The scan estimates room type, visible heating points, window count, possible AC, and building age clues when they are visible."
          />
          <InfoCard
            icon={ShieldCheck}
            title="Honest confidence"
            text="Brand/model sources are only shown when the product identity is confident enough. Otherwise Kenergy Loop uses generic consumption ranges."
          />
          <div className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">What you get back</div>
                <p className="mt-1 text-muted-foreground">
                  A shareable energy percentile, rough kWh ranges, likely devices, brand confidence, and a first saving action.
                </p>
              </div>
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-background text-primary">
                <Gauge className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-background">
              <div className="h-full w-2/3 rounded-full bg-primary" />
            </div>
          </div>
        </aside>
      </main>
      <SiteFooter />
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="mt-4 font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function InsightStrip({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-sm font-bold">{value}</div>
        </div>
      </div>
    </div>
  );
}

function AnalyzingRoom({ stage }: { stage: string }) {
  const steps = ["Detect devices", "Estimate loads", "Build percentile", "Build result"];

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-primary/25 bg-background/90 p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-4">
        <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/20" />
          <Sparkles className="relative h-7 w-7 animate-pulse" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Analyzing your room...</div>
          <p className="mt-1 text-sm text-muted-foreground">{stage}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step} className="rounded-xl bg-primary/5 px-3 py-2 text-xs font-medium text-primary" style={{ animationDelay: `${index * 120}ms` }}>
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
