import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "nodejs",
  api: {
    bodyParser: true, // IMPORTANT
  },
};

// -------- R2 CLIENT --------
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// -------- SUPABASE --------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// -------- TOKEN GENERATOR --------
function generateToken(length = 8) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < length; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export default async function handler(req, res) {
  // ---------- CORS ----------
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
    const { fileName, fileSize, fileType, existingToken } = req.body || {};

    if (!fileName) {
      return res.status(400).json({ error: "fileName missing" });
    }

    // -------- USE EXISTING TOKEN FOR MULTI FILE --------
    let token = existingToken;

    if (!token) {
      token = generateToken();
    }

    const objectKey = `${token}/${fileName}`;

    // -------- GENERATE R2 SIGNED URL --------
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: objectKey,
      ContentType: fileType || "application/octet-stream",
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 60 * 5,
    });

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${objectKey}`;

    // -------- INSERT INTO SUPABASE --------
    const { error } = await supabase.from("shares").insert([
      {
        token,
        file_name: fileName,
        file_size: fileSize || 0,
        file_url: publicUrl,
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ),
      },
    ]);

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      token,
      uploadUrl,
      publicUrl,
    });
  } catch (err) {
    console.error("Create upload error:", err);
    return res.status(500).json({ error: err.message });
  }
}
