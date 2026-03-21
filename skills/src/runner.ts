/**
 * Skill execution runner — wraps skill.execute() with:
 * 1. Feed posting (posts result to unified agent feed)
 * 2. Audit logging (writes to immutable_ledger via event bus)
 * 3. Timing and error handling
 *
 * When shre-sdk is available, integrates with the Shre event bus.
 * Without shre-sdk, runs skills standalone (no feed/audit).
 */

import type { ArosSkill, SkillContext, SkillOutput } from "./types.js";

// shre-sdk is optional — gracefully degrade when not available
let postToFeed: ((bus: any, entry: any) => Promise<void>) | null = null;
let audit: ((bus: any, action: string, data: any, agentId: string) => Promise<void>) | null = null;

try {
  const feed = await import("shre-sdk/feed");
  postToFeed = feed.postToFeed;
  audit = feed.audit;
} catch {
  // shre-sdk not available — standalone mode
}

export interface EventBus {
  publish(channel: string, data: unknown): Promise<void>;
}

export interface RunSkillOptions {
  /** Override agent ID (default: "aros-agent") */
  agentId?: string;
  /** Override agent emoji (default: "🤖") */
  agentEmoji?: string;
  /** Store ID for multi-store context */
  storeId?: string;
  /** Whether to post to the feed (default: true) */
  postToFeedEnabled?: boolean;
  /** Whether to audit (default: true) */
  auditEnabled?: boolean;
}

/**
 * Execute a skill and automatically post results to the feed + audit ledger.
 */
export async function runSkill(
  bus: EventBus | null,
  skill: ArosSkill,
  context: SkillContext,
  options: RunSkillOptions = {},
): Promise<SkillOutput> {
  const agentId = options.agentId ?? "aros-agent";
  const agentEmoji = options.agentEmoji ?? "🤖";
  const storeId = options.storeId ?? context.store.storeId;
  const shouldPost = options.postToFeedEnabled !== false && postToFeed !== null && bus !== null;
  const shouldAudit = options.auditEnabled !== false && audit !== null && bus !== null;

  const startTime = Date.now();
  let output: SkillOutput;

  try {
    output = await skill.execute(context);
  } catch (err) {
    const duration_ms = Date.now() - startTime;

    if (shouldAudit) {
      await audit!(bus, "skill.execute", {
        skillId: skill.id,
        storeId,
        duration_ms,
        success: false,
        error: (err as Error).message,
      }, agentId).catch(() => {});
    }

    if (shouldPost) {
      await postToFeed!(bus, {
        agentId,
        agentEmoji,
        category: "alert",
        severity: "critical",
        title: `${skill.name}: execution failed`,
        body: (err as Error).message,
        data: { error: true, skillId: skill.id },
        skillId: skill.id,
        storeId,
        tags: [skill.category, "error"],
      }).catch(() => {});
    }

    throw err;
  }

  const duration_ms = Date.now() - startTime;

  if (shouldAudit) {
    await audit!(bus, "skill.execute", {
      skillId: skill.id,
      storeId,
      duration_ms,
      alertCount: output.alerts?.length ?? 0,
      success: true,
    }, agentId).catch(() => {});
  }

  if (shouldPost) {
    const severity = output.alerts?.some(a => a.severity === "critical")
      ? "critical" as const
      : output.alerts?.some(a => a.severity === "warning")
        ? "warning" as const
        : "info" as const;

    await postToFeed!(bus, {
      agentId,
      agentEmoji,
      category: "skill_result",
      severity,
      title: `${skill.name}: ${output.summary}`,
      body: output.alerts?.map(a => `${a.severity}: ${a.message}`).join("\n"),
      data: { actions: output.actions, metrics: output.data },
      skillId: skill.id,
      storeId,
      tags: [skill.category],
    }).catch(() => {});
  }

  return output;
}
