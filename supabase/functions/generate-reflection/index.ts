import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.36.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const period: "weekly" | "monthly" = body.period === "monthly" ? "monthly" : "weekly";
    const days = period === "monthly" ? 30 : 7;
    const type = period === "monthly" ? "monthly_reflection" : "weekly_reflection";
    const label = period === "monthly" ? "30-day" : "7-day";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    console.log("Generating", type, "for user:", user.id);

    const { data: rows, error: habitsErr } = await supabase
      .from("habits")
      .select("data")
      .eq("user_id", user.id);

    if (habitsErr) return json({ error: "Failed to fetch habits" }, 500);

    const habits: any[] = (rows || []).map((r: any) => r.data);

    let content: string;

    if (habits.length === 0) {
      content = `No habits tracked yet — start building habits to unlock your ${label} reflection! 🚀`;
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const numWeeks = Math.ceil(days / 7);

      const statsLines = habits.map((h) => {
        let doneDays = 0;
        const weeklyBuckets: number[] = Array(numWeeks).fill(0);

        for (let i = 0; i < days; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          const count = h.log?.[key] || 0;
          const done = h.type === "multi" ? count >= h.target : count >= 1;
          if (done) {
            doneDays++;
            weeklyBuckets[Math.min(Math.floor(i / 7), numWeeks - 1)]++;
          }
        }

        const pct = Math.round((doneDays / days) * 100);
        const weekBreakdown = weeklyBuckets
          .map((n, i) => `wk${i + 1}: ${n}/${Math.min(7, days - i * 7)}`)
          .join(", ");
        const extra = h.type === "multi" ? ` (target ${h.target}×/day)` : "";
        return `• ${h.name}${extra}: ${pct}% (${doneDays}/${days} days) [${weekBreakdown}]`;
      });

      const prompt = `You are a thoughtful habit coach writing a ${label} reflection. User data:

${statsLines.join("\n")}

Write a warm, insight-driven reflection (3–5 sentences). Requirements:
- Open with the single biggest win using their actual habit name and percentage
- Identify one meaningful pattern (e.g., "mid-week dip", "weekends stronger", "consistency building")
- Name the one habit that needs the most attention and suggest a specific strategy
- Close with a forward-looking motivational sentence for the next ${period === "monthly" ? "month" : "week"}
No bullet points. Sound like a coach who genuinely knows them, not a report.`;

      console.log("Calling Claude API for reflection...");

      const anthropic = new Anthropic({
        apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
      });

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 450,
        messages: [{ role: "user", content: prompt }],
      });

      console.log("Claude responded, stop_reason:", response.stop_reason);

      const block = response.content.find((b: any) => b.type === "text");
      content = (block as any)?.text ?? "Great work this week — keep the momentum going!";
    }

    const { error: insertErr } = await admin.from("coaching_messages").insert({
      user_id: user.id,
      type,
      content,
    });

    if (insertErr) console.error("Insert error:", insertErr);

    return json({ content });
  } catch (err) {
    console.error("generate-reflection fatal error:", err);
    return json({ error: String(err) }, 500);
  }
});
