import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import supabase from "../../lib/supabase";

export const config = { runtime: "nodejs" };

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

function generateToken(length = 8) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { files } = req.body; // ← expect array

    if (!files || !files.length) {
      return res.status(400).json({ error: "No files provided" });
    }

    const token = generateToken();

    const uploadData = [];
    const supabaseRows = [];

    for (const file of files) {
      const objectKey = `${token}/${file.fileName}`;

      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: objectKey,
        ContentType: file.fileType,
      });

      const uploadUrl = await getSignedUrl(s3, command, {
        expiresIn: 60 * 5,
      });

      const publicUrl = `${process.env.R2_PUBLIC_URL}/${objectKey}`;

      uploadData.push({
        fileName: file.fileName,
        uploadUrl,
      });

      supabaseRows.push({
        token,
        file_name: file.fileName,
        file_size: file.fileSize,
        file_url: publicUrl,
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ),
      });
    }

    // 🔥 Insert ALL files at once
    const { error } = await supabase.from("shares").insert(supabaseRows);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      token,
      uploads: uploadData,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
