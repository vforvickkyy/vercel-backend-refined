import { createClient } from "@supabase/supabase-js";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.headers.authorization !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const { id } = req.body;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1️⃣ Get file info first
    const { data: file, error: fetchError } = await supabase
      .from("shares")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    // 2️⃣ Setup R2 client
    const s3 = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY,
        secretAccessKey: process.env.R2_SECRET_KEY
      }
    });

    // Extract object key from file_url
    const key = file.file_url.split("/").pop();

    // 3️⃣ Delete from R2
    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key
      })
    );

    // 4️⃣ Delete from Supabase
    await supabase
      .from("shares")
      .delete()
      .eq("id", id);

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
