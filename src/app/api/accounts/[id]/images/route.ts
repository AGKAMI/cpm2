/** FLEET LEDGER — Account images.
 * GET    /api/accounts/[id]/images — list images for an account
 * POST   /api/accounts/[id]/images — bulk upload images (multipart/form-data, field "files")
 */

import { fail, ok } from "@/lib/route";
import { currentUserId } from "@/lib/auth";
import { parseId } from "@/lib/http";
import {
  addAccountImages,
  getAccount,
  listAccountImages,
} from "@/lib/service-turso";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/** List all images for an account. */
export async function GET(
  request: Request,
  context: RouteContext,
) {
  try {
    const userId = currentUserId(request);
    const { id } = await context.params;
    const accountId = parseId(id);
    const images = await listAccountImages(accountId);
    return ok({ images });
  } catch (err) {
    return fail(err);
  }
}

/** Bulk upload images for an account. */
export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const userId = currentUserId(request);
    const { id } = await context.params;
    const accountId = parseId(id);

    // Verify account exists and is owned by the user before accepting files
    await getAccount(accountId, userId);

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return fail({
        status: 400,
        body: { error: { code: "missing_files", message: "No files provided." } },
      });
    }

    const uploadsDir = join(process.cwd(), "public", "uploads", "fleet");
    await mkdir(uploadsDir, { recursive: true });

    const imageUrls: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        return fail({
          status: 400,
          body: {
            error: {
              code: "invalid_file_type",
              message: `File "${file.name}" must be an image.`,
            },
          },
        });
      }

      const ext = file.name.split(".").pop() ?? "jpg";
      const filename = `${crypto.randomUUID()}.${ext}`;
      const filepath = join(uploadsDir, filename);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filepath, buffer);

      imageUrls.push(`/api/accounts/${accountId}/images/${filename}`);
    }

    const inserted = await addAccountImages(accountId, imageUrls, userId);
    return ok({ images: inserted }, 201);
  } catch (err) {
    return fail(err);
  }
}
