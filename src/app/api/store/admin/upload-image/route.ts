/**
 * VANTA GARAGE — Admin image upload.
 * POST /api/store/admin/upload-image — upload an image file, returns a public URL.
 */

import { fail, ok } from "@/lib/route";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

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

    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const ext = file.name.split(".").pop() ?? "jpg";
    const filename = `${crypto.randomUUID()}.${ext}`;
    const filepath = join(uploadsDir, filename);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    const url = `/api/store/admin/uploads/${filename}`;
    return ok({ url });
  } catch (err) {
    return fail(err);
  }
}
