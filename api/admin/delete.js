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

    if (!id) {
      return res.status(400).json({ message: "Missing id" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1️⃣ Fetch file
const { data: file, error: fetchError } = await supabase
  .from("shares")
  .select("*")
  .eq("id", Number(id))
  .single();

if (!file) {
  return res.status(404).json({ message: "File not found" });
}

// 2️⃣ Extract correct key
const key = new URL(file.file_url).pathname.substring(1);

// 3️⃣ Delete from R2
await s3.send(
  new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key
  })
);

// 4️⃣ Delete from DB
await supabase
  .from("shares")
  .delete()
  .eq("id", Number(id));

    if (deleteError) throw deleteError;

    return res.status(200).json({
      success: true,
      deletedId: id
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
