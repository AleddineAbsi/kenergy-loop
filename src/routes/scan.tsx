import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Building2, CheckCircle2, ImagePlus, Loader2, ShieldCheck, Sparkles, Zap } from "lucide-react";
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
      { title: "Scan a room - Kenergy" },
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
            AI room energy scan
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Scan a room</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Upload one clear photo. Kenergy looks for visible machines, heating, cooling, windows, standby loads,
            product clues, and then estimates rough yearly consumption with confidence levels.
          </p>

          {!user && !authLoading && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm shadow-[var(--shadow-soft)]">
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>{" "}
              to save the scan result. Photos are stored privately in your Supabase project.
            </div>
          )}

          <div className="mt-7 rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
            <label
              className="group block cursor-pointer rounded-2xl border-2 border-dashed border-border bg-background p-4 text-center transition-colors hover:border-primary hover:bg-primary/5 sm:p-6"
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
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
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

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{stage}</p>
              <button
                type="button"
                disabled={!file || busy || !user}
                onClick={runScan}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] disabled:cursor-not-allowed disabled:opacity-50"
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
            text="Brand/model sources are only shown when the product identity is confident enough. Otherwise Kenergy uses generic consumption ranges."
          />
          <div className="rounded-2xl border border-border bg-card p-5 text-sm shadow-[var(--shadow-soft)]">
            <div className="font-semibold">Best photo for the demo</div>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              {["Use a wide room shot.", "Keep appliances visible.", "Avoid blurry or dark photos.", "Include windows, radiators, AC, or desk setups if present."].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
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
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="mt-4 font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
