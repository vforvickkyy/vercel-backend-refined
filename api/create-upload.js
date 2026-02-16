import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "nodejs",
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/* 🔥 CRITICAL FIX — remove checksum middleware (fixes 403) */
s3.middlewareStack.remove("flexibleChecksumsMiddleware");

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { token, fileName, fileSize, fileType } = req.body;

    if (!fileName || !fileSize) {
      return res.status(400).json({ error: "Missing file data" });
    }

    /* Generate token only once */
    const uploadToken =
      token || Math.random().toString(36).substring(2, 10);

    const cleanFileName = fileName.replace(/\s+/g, "_");
    const key = `${uploadToken}/${cleanFileName}`;

    /* Create presigned PUT URL */
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ContentType: fileType || "application/octet-stream",
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 60 * 10,
    });

    /* Public file URL */
    const publicUrl = `https://${process.env.R2_PUBLIC_DOMAIN}/${key}`;

    /* Insert into Supabase */
    const { error } = await supabase
      .from("uploads")
      .insert([
        {
          token: uploadToken,
          file_name: fileName,
          file_url: publicUrl,
          file_size: fileSize,
          expires_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ),
        },
      ]);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Database insert failed" });
    }

    return res.status(200).json({
      token: uploadToken,
      uploadUrl,
      fileUrl: publicUrl,
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
