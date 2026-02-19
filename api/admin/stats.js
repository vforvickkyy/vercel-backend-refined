import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.headers.authorization !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("shares")
      .select("*");

    if (error) throw error;

    const totalFiles = data.length;
    const totalSize = data.reduce((acc, file) => acc + file.file_size, 0);

    const now = new Date();

    const activeFiles = data.filter(
      f => new Date(f.expires_at) > now
    ).length;

    const expiredFiles = totalFiles - activeFiles;

    return res.status(200).json({
      totalFiles,
      totalSize,
      activeFiles,
      expiredFiles
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
