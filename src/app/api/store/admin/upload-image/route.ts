/**
 * VANTA GARAGE — Admin image upload.
 * POST /api/store/admin/upload-image — upload an image file, returns a public URL.
 */

import { fail, ok } from "@/lib/route";
import { saveUpload } from "@/lib/store/uploads";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return fail({
        status: 400,
        body: { error: { code: "missing_file", message: "No file provided." } },
      });
    }

    if (!file.type.startsWith("image/")) {
      return fail({
        status: 400,
        body: { error: { code: "invalid_file_type", message: "File must be an image." } },
      });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const filename = `${crypto.randomUUID()}.${ext}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    // DB-backed (see lib/store/uploads.ts) — survives read-only serverless FS;
    // disk cache is best-effort, so this never EROFS on Vercel.
    await saveUpload(filename, buffer);

    const url = `/api/store/admin/uploads/${filename}`;
    return ok({ url });
  } catch (err) {
    return fail(err);
  }
}
