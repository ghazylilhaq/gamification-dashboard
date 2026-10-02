/**
 * Display names for activity_list.quest_id.
 *
 * The export carries only the number, so the names live here — the one place
 * to edit if a quest is renamed or a new one is added. An id missing from this
 * map falls back to "Quest N" rather than breaking.
 */
export const QUEST_NAMES: Record<number, string> = {
  1: 'Starter Quest',
  2: 'Lifestyle Quest',
  3: 'Savers Quest',
  4: 'Special Quest',
  5: 'Paylater Quest',
};

export function questName(questId: number | null | undefined): string {
  if (questId === null || questId === undefined) return 'Unassigned';
  return QUEST_NAMES[questId] ?? `Quest ${questId}`;
}
