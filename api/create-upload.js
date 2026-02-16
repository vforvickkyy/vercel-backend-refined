import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateToken() {
  return Math.random().toString(36).substring(2, 10);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { token, fileName, fileSize } = req.body;

    if (!fileName || !fileSize) {
      return res.status(400).json({ error: "Missing file data" });
    }

    const uploadToken = token || generateToken();
    const key = `${uploadToken}/${fileName}`;

    // 🔐 Generate signed upload URL
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 60,
    });

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    const { error } = await supabase.from("shares").insert({
      token: uploadToken,
      file_name: fileName,
      file_url: publicUrl,
      file_size: fileSize,
      expires_at: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: "Database insert failed",
      });
    }

    return res.status(200).json({
      token: uploadToken,
      uploadUrl: signedUrl,   // ✅ THIS IS IMPORTANT
      fileUrl: publicUrl,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
