import { createClient } from "@supabase/supabase-js";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export default async function handler(req, res) {
  // ------------------------
  // CORS
  // ------------------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ------------------------
  // Auth
  // ------------------------
  if (req.headers.authorization !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Missing file ID" });
    }

    const numericId = Number(id);

    if (isNaN(numericId)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    // ------------------------
    // Supabase Client
    // ------------------------
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ------------------------
    // Fetch File Record First
    // ------------------------
    const { data: file, error: fetchError } = await supabase
      .from("shares")
      .select("*")
      .eq("id", numericId)
      .single();

    if (fetchError || !file) {
      return res.status(404).json({ message: "File not found in database" });
    }

    // ------------------------
    // Setup R2 Client
    // ------------------------
    const s3 = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY,
        secretAccessKey: process.env.R2_SECRET_KEY
      }
    });

    // ------------------------
    // Extract Correct Object Key
    // ------------------------
    // Example file_url:
    // https://pub-xxxx.r2.dev/folder/file.mp4
    // We extract: folder/file.mp4

    const key = new URL(file.file_url).pathname.substring(1);

    // ------------------------
    // Delete From R2
    // ------------------------
    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key
      })
    );

    // ------------------------
    // Delete From Supabase
    // ------------------------
    const { error: deleteError } = await supabase
      .from("shares")
      .delete()
      .eq("id", numericId);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    return res.status(200).json({
      success: true,
      deletedId: numericId
    });

  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({ error: err.message });
  }
}