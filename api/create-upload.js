import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateToken() {
  return Math.random().toString(36).substring(2, 10);
}

export default async function handler(req, res) {
  // ==========================
  // CORS HEADERS
  // ==========================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
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

    let uploadToken = token || generateToken();

    const fileKey = `${uploadToken}/${fileName}`;

    const fileUrl = `${process.env.R2_PUBLIC_URL}/${fileKey}`;

    const { error } = await supabase.from("shares").insert({
      token: uploadToken,
      file_name: fileName,
      file_url: fileUrl,
      file_size: fileSize,
      expires_at: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({
        error: "Database insert failed",
        details: error.message,
      });
    }

    return res.status(200).json({
      token: uploadToken,
      uploadUrl: fileUrl,
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
