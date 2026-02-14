import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

/* =========================
   ENV VARIABLES REQUIRED
========================= */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/* =========================
   VERCEL BODY PARSER
========================= */

export const config = {
  api: {
    bodyParser: true,
  },
};

/* =========================
   HANDLER
========================= */

export default async function handler(req, res) {
  /* ---------- CORS ---------- */
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
    const { token, fileName, fileSize, fileType } = req.body;

    if (!fileName || !fileSize) {
      return res.status(400).json({ error: "Missing file data" });
    }

    /* =========================
       TOKEN LOGIC
    ========================= */

    let shareToken = token;

    if (!shareToken) {
      // Create new share token only once
      shareToken = crypto.randomBytes(4).toString("hex");
    }

    /* =========================
       CREATE R2 SIGNED URL
    ========================= */

    const objectKey = `${shareToken}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: fileType || "application/octet-stream",
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 60 * 10, // 10 minutes
    });

    /* =========================
       INSERT INTO SUPABASE
    ========================= */

    const publicFileUrl = `${process.env.R2_PUBLIC_URL}/${objectKey}`;

    const { error } = await supabase.from("shares").insert([
      {
        token: shareToken,
        file_name: fileName,
        file_url: publicFileUrl,
        file_size: fileSize,
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    ]);

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ error: error.message });
    }

    /* =========================
       SUCCESS RESPONSE
    ========================= */

    return res.status(200).json({
      token: shareToken,
      uploadUrl,
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
