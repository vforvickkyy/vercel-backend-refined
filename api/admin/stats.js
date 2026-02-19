import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.headers.authorization !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data } = await supabase.from("shares").select("*");

  const totalFiles = data.length;
  const totalSize = data.reduce((acc, file) => acc + file.file_size, 0);

  const now = new Date();

  const activeFiles = data.filter(f => new Date(f.expires_at) > now).length;
  const expiredFiles = totalFiles - activeFiles;

  res.json({
    totalFiles,
    totalSize,
    activeFiles,
    expiredFiles
  });
}
