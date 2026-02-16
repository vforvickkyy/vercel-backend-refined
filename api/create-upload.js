import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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

function generateToken() {
  return Math.random().toString(36).substring(2, 10);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { token, fileName, fileSize, fileType } = req.body;

    if (!fileName || !fileSize) {
      return res.status(400).json({ error: "Missing file data" });
    }

    let uploadToken = token;

    // If no token provided → generate new one
    if (!uploadToken) {
      uploadToken = generateToken();
    }

    const fileKey = `${uploadToken}/${fileName}`;

    const uploadUrl = `${process.env.R2_PUBLIC_URL}/${fileKey}`;

    // INSERT into Supabase
    const { error } = await supabase
      .from("shares")
      .insert({
        token: uploadToken,
        file_name: fileName,
        file_url: uploadUrl,
        file_size: fileSize,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({
        error: "Database insert failed",
        details: error.message,
      });
    }

    return res.status(200).json({
      token: uploadToken,
      uploadUrl,
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
