/**
 * Opening/Closing Checklist — Digital SOP Compliance Tracker
 *
 * Manages store opening and closing procedures as digital checklists.
 * Tracks completion by employee, flags missed items, and calculates
 * compliance rates over time.
 *
 * Default checklist items are provided for common store types.
 * Stores can customize via their checklist_templates table.
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  ChecklistItem,
  ChecklistCompletion,
  Alert,
  Action,
} from '../types.js';

interface ChecklistStatus {
  item: ChecklistItem;
  completed: boolean;
  completedBy: string | null;
  completedAt: string | null;
  notes: string | null;
}

interface ChecklistReport {
  type: 'opening' | 'closing';
  items: ChecklistStatus[];
  completedCount: number;
  totalCount: number;
  requiredCompletedCount: number;
  requiredTotalCount: number;
  compliancePct: number;
  missedRequired: ChecklistStatus[];
}

interface ChecklistData {
  opening: ChecklistReport;
  closing: ChecklistReport;
  overallCompliancePct: number;
}

/** Default checklist items when no template is configured */
const DEFAULT_CHECKLIST: ChecklistItem[] = [
  // Opening
  { id: 'open-01', label: 'Disarm alarm system', category: 'opening', required: true },
  { id: 'open-02', label: 'Turn on lights and signage', category: 'opening', required: true },
  { id: 'open-03', label: 'Count opening cash drawer', category: 'opening', required: true },
  { id: 'open-04', label: 'Check cooler/freezer temperatures', category: 'opening', required: true },
  { id: 'open-05', label: 'Stock and face shelves', category: 'opening', required: false },
  { id: 'open-06', label: 'Clean floors and counters', category: 'opening', required: false },
  { id: 'open-07', label: 'Verify POS systems are online', category: 'opening', required: true },
  { id: 'open-08', label: 'Check restrooms', category: 'opening', required: false },
  // Closing
  { id: 'close-01', label: 'Run end-of-day POS report', category: 'closing', required: true },
  { id: 'close-02', label: 'Count and reconcile cash drawers', category: 'closing', required: true },
  { id: 'close-03', label: 'Prepare bank deposit', category: 'closing', required: true },
  { id: 'close-04', label: 'Clean and sanitize food areas', category: 'closing', required: true },
  { id: 'close-05', label: 'Empty trash and recycling', category: 'closing', required: false },
  { id: 'close-06', label: 'Lock coolers and storage', category: 'closing', required: true },
  { id: 'close-07', label: 'Turn off unnecessary lights', category: 'closing', required: false },
  { id: 'close-08', label: 'Set alarm system', category: 'closing', required: true },
];

function buildReport(
  type: 'opening' | 'closing',
  template: ChecklistItem[],
  completions: ChecklistCompletion[]
): ChecklistReport {
  const typeItems = template.filter(
    i => i.category === type || i.category === 'both'
  );

  const completionMap = new Map(
    completions.map(c => [c.checklist_item_id, c])
  );

  const items: ChecklistStatus[] = typeItems.map(item => {
    const completion = completionMap.get(item.id);
    return {
      item,
      completed: completion?.completed ?? false,
      completedBy: completion?.completed_by ?? null,
      completedAt: completion?.completed_at ?? null,
      notes: completion?.notes ?? null,
    };
  });

  const completedCount = items.filter(i => i.completed).length;
  const requiredItems = items.filter(i => i.item.required);
  const requiredCompletedCount = requiredItems.filter(i => i.completed).length;
  const missedRequired = requiredItems.filter(i => !i.completed);

  const compliancePct = requiredItems.length > 0
    ? (requiredCompletedCount / requiredItems.length) * 100
    : 100;

  return {
    type,
    items,
    completedCount,
    totalCount: items.length,
    requiredCompletedCount,
    requiredTotalCount: requiredItems.length,
    compliancePct,
    missedRequired,
  };
}

export class OpeningClosingChecklistSkill implements ArosSkill {
  readonly id = 'opening-closing-checklist';
  readonly name = 'Opening/Closing Checklist';
  readonly category = 'workforce' as const;
  readonly frequency = 'daily' as const;
  readonly requiredData = ['checklist_templates', 'checklist_completions'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, today } = context;

    const [template, completions] = await Promise.all([
      connector.getChecklistTemplate(),
      connector.getChecklistCompletions(today),
    ]);

    // Use default template if none configured
    const checklistTemplate = template.length > 0 ? template : DEFAULT_CHECKLIST;

    const opening = buildReport('opening', checklistTemplate, completions);
    const closing = buildReport('closing', checklistTemplate, completions);

    const totalRequired = opening.requiredTotalCount + closing.requiredTotalCount;
    const totalRequiredCompleted = opening.requiredCompletedCount + closing.requiredCompletedCount;
    const overallCompliancePct = totalRequired > 0
      ? (totalRequiredCompleted / totalRequired) * 100
      : 100;

    const data: ChecklistData = { opening, closing, overallCompliancePct };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    // Flag missed required items
    for (const missed of opening.missedRequired) {
      alerts.push({
        severity: 'warning',
        message: `Opening: "${missed.item.label}" not completed (required)`,
        code: 'MISSED_REQUIRED_CHECKLIST',
        entity: missed.item.id,
      });
    }

    for (const missed of closing.missedRequired) {
      alerts.push({
        severity: 'warning',
        message: `Closing: "${missed.item.label}" not completed (required)`,
        code: 'MISSED_REQUIRED_CHECKLIST',
        entity: missed.item.id,
      });
    }

    // Critical if compliance below 80%
    if (overallCompliancePct < 80 && totalRequired > 0) {
      alerts.push({
        severity: 'critical',
        message: `SOP compliance at ${overallCompliancePct.toFixed(0)}% — multiple required items missed`,
        code: 'LOW_SOP_COMPLIANCE',
        value: overallCompliancePct,
        threshold: 80,
      });
      actions.push({
        description: 'Review SOP compliance with shift managers — below 80% threshold',
        priority: 2,
        automatable: false,
      });
    }

    const summary = `Checklist compliance: ${overallCompliancePct.toFixed(0)}%. Opening: ${opening.completedCount}/${opening.totalCount} (${opening.compliancePct.toFixed(0)}% required). Closing: ${closing.completedCount}/${closing.totalCount} (${closing.compliancePct.toFixed(0)}% required).`;

    return {
      skillId: this.id,
      timestamp: new Date().toISOString(),
      summary,
      alerts,
      actions,
      data: data as unknown as Record<string, unknown>,
    };
  }
}
