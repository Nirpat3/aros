/**
 * Skill execution runner — wraps skill.execute() with:
 * 1. Feed posting (posts result to unified agent feed)
 * 2. Audit logging (writes to immutable_ledger via event bus)
 * 3. Timing and error handling
 *
 * Usage:
 *   import { runSkill } from "@aros/skills/runner";
 *   import { createEventBus } from "shre-sdk/events";
 *
 *   const bus = createEventBus("aros-agent");
 *   const output = await runSkill(bus, skill, context);
 */

import type { EventBus } from "shre-sdk/events";
import { postToFeed, audit } from "shre-sdk/feed";
import type { ArosSkill, SkillContext, SkillOutput } from "./types.js";

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
  bus: EventBus,
  skill: ArosSkill,
  context: SkillContext,
  options: RunSkillOptions = {},
): Promise<SkillOutput> {
  const agentId = options.agentId ?? "aros-agent";
  const agentEmoji = options.agentEmoji ?? "🤖";
  const storeId = options.storeId ?? context.store.storeId;
  const shouldPost = options.postToFeedEnabled !== false;
  const shouldAudit = options.auditEnabled !== false;

  const startTime = Date.now();
  let output: SkillOutput;

  try {
    output = await skill.execute(context);
  } catch (err) {
    const duration_ms = Date.now() - startTime;

    // Audit the failure
    if (shouldAudit) {
      await audit(bus, "skill.execute", {
        skillId: skill.id,
        storeId,
        duration_ms,
        success: false,
        error: (err as Error).message,
      }, agentId).catch(() => {});
    }

    // Post failure to feed
    if (shouldPost) {
      await postToFeed(bus, {
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

  // Audit the execution
  if (shouldAudit) {
    await audit(bus, "skill.execute", {
      skillId: skill.id,
      storeId,
      duration_ms,
      alertCount: output.alerts?.length ?? 0,
      success: true,
    }, agentId).catch(() => {});
  }

  // Post result to feed
  if (shouldPost) {
    const severity = output.alerts?.some(a => a.severity === "critical")
      ? "critical" as const
      : output.alerts?.some(a => a.severity === "warning")
        ? "warning" as const
        : "info" as const;

    await postToFeed(bus, {
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
