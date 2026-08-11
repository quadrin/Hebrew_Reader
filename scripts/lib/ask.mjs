/* A small JSON-answering client used by the build scripts.

   Both providers answer the same shape, so callers don't care which one ran;
   answers are cached on disk by key, which is what keeps a rebuild free and
   keeps the generated data reproducible for anyone without an API key. */

import { readFileSync, writeFileSync, existsSync } from "fs";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DEFAULT_MODEL = { anthropic: "claude-opus-5", openai: "gpt-5.1" };

/* Explicit choice wins; otherwise use whichever key is in the environment. */
export function resolveProvider({ provider, apiKey, model } = {}) {
  const anthropicKey = apiKey || process.env.ANTHROPIC_API_KEY || "";
  const openaiKey = apiKey || process.env.OPENAI_API_KEY || "";
  const chosen = provider
    || (process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY ? "openai" : "anthropic");
  return {
    provider: chosen,
    key: chosen === "openai" ? openaiKey : anthropicKey,
    model: model || DEFAULT_MODEL[chosen] || DEFAULT_MODEL.anthropic,
  };
}

async function anthropicAsker({ key, model, schema, system }) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key, maxRetries: 4 });
  return async (prompt, maxTokens) => {
    const res = await client.messages.create({
      model,
      max_tokens: maxTokens,
      /* Simple, well-specified work — low effort keeps a long run cheap.
         Thinking stays on: disabling it on Opus 5 can leak internal tags. */
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system,
      messages: [{ role: "user", content: prompt }],
    });
    return JSON.parse(res.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
  };
}

function openaiAsker({ key, model, schema, system }) {
  return async (prompt, maxTokens) => {
    const body = {
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      response_format: { type: "json_schema", json_schema: { name: "answer", strict: true, schema } },
    };
    /* GPT-5 spends reasoning tokens from the same budget, so it needs both the
       newer field and room above the visible answer. */
    if (/^gpt-5/.test(model)) {
      body.reasoning_effort = "low";
      body.max_completion_tokens = maxTokens;
    } else {
      body.max_tokens = maxTokens;
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });
      if (r.status === 429 || r.status >= 500) {
        await sleep(Number(r.headers.get("retry-after")) * 1000 || 2000 * 2 ** attempt);
        continue;
      }
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error?.message || `openai ${r.status}`);
      return JSON.parse(data.choices[0].message.content);
    }
    throw new Error("openai rate-limited after 5 attempts");
  };
}

export async function makeAsker({ provider, key, model, schema, system }) {
  return provider === "openai"
    ? openaiAsker({ key, model, schema, system })
    : anthropicAsker({ key, model, schema, system });
}

/* Runs `jobs` through the asker with a fixed concurrency, filling `cache` as it
   goes. Each job is {id, prompt}. Returns the cache. */
export async function askAll({ jobs, cachePath, ask, concurrency = 4, maxTokens = 2000, label = "answers" }) {
  let cache = {};
  if (existsSync(cachePath)) {
    try { cache = JSON.parse(readFileSync(cachePath, "utf8")); } catch (e) {}
  }
  const missing = jobs.filter((j) => !cache[j.id]);
  if (!missing.length) {
    console.log(`${label}: all ${jobs.length} cached`);
    return cache;
  }
  if (!ask) {
    console.log(`${label}: ${missing.length} missing and no API key — run again with`);
    console.log("  ANTHROPIC_API_KEY=… or OPENAI_API_KEY=… to fill them in.");
    return cache;
  }

  console.log(`${label}: asking for ${missing.length} (${concurrency} at a time)…`);
  let done = 0, failed = 0;
  const queue = [...missing];
  const worker = async () => {
    while (queue.length) {
      const job = queue.shift();
      try {
        cache[job.id] = await ask(job.prompt, maxTokens);
        if (++done % 10 === 0) console.log(`  ${done}/${missing.length}`);
      } catch (e) {
        failed++;
        console.warn(`  ${job.id} failed: ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

  writeFileSync(cachePath, JSON.stringify(cache, null, 1));
  console.log(`  ${done} written${failed ? `, ${failed} failed` : ""}`);
  return cache;
}
