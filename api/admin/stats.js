import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // ===== AUTH =====
    if (req.headers.authorization !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ message: "Unauthorized" });
    }
// ================= R2 ANALYTICS =================

let storageBytes = 0;
let classAOps = 0;
let classBOps = 0;

try {
  if (
    process.env.CLOUDFLARE_API_TOKEN &&
    process.env.R2_ACCOUNT_ID
  ) {
    const now = new Date();
    const yesterday = new Date(
      now.getTime() - 24 * 60 * 60 * 1000
    );

    const query = `
    query {
      viewer {
        accounts(filter: {accountTag: "${process.env.R2_ACCOUNT_ID}"}) {
          r2StorageAdaptiveGroups(
            limit: 1
          ) {
            sum {
              payloadSize
            }
          }

          r2OperationsAdaptiveGroups(
            filter: {
              datetime_geq: "${yesterday.toISOString()}"
              datetime_leq: "${now.toISOString()}"
            }
            limit: 1
          ) {
            sum {
              classA
              classB
            }
          }
        }
      }
    }
    `;

    const response = await fetch(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      }
    );

    const json = await response.json();

    if (
      json?.data?.viewer?.accounts?.length > 0
    ) {
      const account = json.data.viewer.accounts[0];

      storageBytes =
        account?.r2StorageAdaptiveGroups?.[0]?.sum
          ?.payloadSize || 0;

      classAOps =
        account?.r2OperationsAdaptiveGroups?.[0]?.sum
          ?.classA || 0;

      classBOps =
        account?.r2OperationsAdaptiveGroups?.[0]?.sum
          ?.classB || 0;
    }
  }
} catch (err) {
  console.log("R2 analytics error:", err);
}
    // ===== INIT SUPABASE SAFELY HERE =====
    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return res.status(500).json({ message: "Missing Supabase ENV" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: shares, error } = await supabase
      .from("shares")
      .select("*");

    if (error) {
      return res.status(500).json({ message: "DB error" });
    }

    const safeShares = shares || [];

    return res.status(200).json({
      totalFiles: safeShares.length,
      totalLinks: safeShares.length,
      recentActivity: [],
      storageUsedFormatted: "0 MB",
      classAOps: 0,
      classBOps: 0,
      linksLast24h: 0,
      totalUsers: 0,
      liveUsers: 0
    });

  } catch (err) {
    console.error("STATS CRASH:", err);
    return res.status(500).json({ message: "Server crash" });
  }
}