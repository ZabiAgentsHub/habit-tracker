import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// esm.sh is a reliable CDN for Deno — avoids npm: cold-start resolution failures
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

function calcStreak(log: Record<string, number>, type: string, target: number): number {
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 90; i++) {
    const key = d.toISOString().slice(0, 10);
    const count = log?.[key] || 0;
    const done = type === "multi" ? count >= target : count >= 1;
    if (!done) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function weekRate(log: Record<string, number>, type: string, target: number): number {
  let done = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = log?.[key] || 0;
    if (type === "multi" ? count >= target : count >= 1) done++;
  }
  return Math.round((done / 7) * 100);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

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

    console.log("Fetching habits for user:", user.id);

    const { data: rows, error: habitsErr } = await supabase
      .from("habits")
      .select("data")
      .eq("user_id", user.id);

    if (habitsErr) {
      console.error("Habits fetch error:", habitsErr);
      return json({ error: "Failed to fetch habits" }, 500);
    }

    const habits: any[] = (rows || []).map((r: any) => r.data);
    console.log("Habits count:", habits.length);

    let content: string;

    if (habits.length === 0) {
      content = "Add your first habit to start receiving personalized coaching! Every journey begins with a single step. 🌱";
    } else {
      const lines = habits.map((h) => {
        const streak = calcStreak(h.log || {}, h.type, h.target);
        const pct = weekRate(h.log || {}, h.type, h.target);
        const extra = h.type === "multi" ? ` (goal: ${h.target}× per day)` : "";
        const streakLabel = streak > 0 ? `${streak}-day streak` : "no current streak";
        return `• ${h.name}${extra}: ${streakLabel}, ${pct}% this week`;
      });

      const prompt = `You are an enthusiastic, supportive habit coach. The user's current habit stats:

${lines.join("\n")}

Write a punchy, personalized coaching nudge (2–3 sentences max). Rules:
- Mention specific habit names and real numbers from the data
- Celebrate what's going well with genuine enthusiasm
- For any habit under 50% this week, give one concrete micro-tip
- End with a motivating push. No bullet points, no generic advice.`;

      console.log("Calling Claude API...");

      const anthropic = new Anthropic({
        apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
      });

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      console.log("Claude responded, stop_reason:", response.stop_reason);

      const block = response.content.find((b: any) => b.type === "text");
      content = (block as any)?.text ?? "Keep going — every habit you track is a step forward!";
    }

    const { error: insertErr } = await admin.from("coaching_messages").insert({
      user_id: user.id,
      type: "nudge",
      content,
    });

    if (insertErr) console.error("Insert error:", insertErr);

    return json({ content });
  } catch (err) {
    console.error("generate-nudge fatal error:", err);
    return json({ error: String(err) }, 500);
  }
});
