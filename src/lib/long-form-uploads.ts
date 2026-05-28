// Browser-side helpers to upload bills/appliance photos and list them.
import { supabase } from "@/integrations/supabase/client";

export type UploadKind = "bill" | "appliance" | "other";

export type LongFormUpload = {
  id: string;
  kind: UploadKind;
  storage_path: string;
  label: string | null;
  notes: string | null;
  created_at: string;
  signedUrl?: string;
};

export async function uploadLongFormFile(
  file: File,
  kind: UploadKind,
  label?: string,
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const ext = file.name.split(".").pop() || "bin";
  const path = `${user.id}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("bill-uploads")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;
  const { error: rowErr } = await supabase.from("long_form_uploads").insert({
    user_id: user.id,
    kind,
    storage_path: path,
    label: label ?? file.name,
  });
  if (rowErr) throw rowErr;
}

export async function listLongFormUploads(): Promise<LongFormUpload[]> {
  const { data, error } = await supabase
    .from("long_form_uploads")
    .select("id, kind, storage_path, label, notes, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as LongFormUpload[];
  // Sign URLs (private bucket).
  await Promise.all(
    rows.map(async (r) => {
      const { data: signed } = await supabase.storage
        .from("bill-uploads")
        .createSignedUrl(r.storage_path, 60 * 60);
      if (signed?.signedUrl) r.signedUrl = signed.signedUrl;
    }),
  );
  return rows;
}

export async function deleteLongFormUpload(id: string, storagePath: string) {
  await supabase.storage.from("bill-uploads").remove([storagePath]);
  const { error } = await supabase.from("long_form_uploads").delete().eq("id", id);
  if (error) throw error;
}
