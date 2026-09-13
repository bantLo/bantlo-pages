/**
 * Equal-split arithmetic, shared by the expense form and the preset quick-add
 * so the two can never disagree about who owes what.
 */

/**
 * Divides a total equally between users, giving the remainder to the last one.
 *
 * ₹100 across 3 people is 33.33 + 33.33 + 33.34 — the last share absorbs the
 * rounding so the splits sum to exactly the total. That exactness matters: the
 * balance triggers derive everyone's standing from these rows, so a stray paisa
 * becomes a permanent discrepancy.
 */
export function computeEqualSplits(total: number, userIds: string[]): Record<string, number> {
  const splits: Record<string, number> = {};
  if (userIds.length === 0) return splits;

  const perPerson = parseFloat((total / userIds.length).toFixed(2));
  let running = 0;

  userIds.forEach((userId, i) => {
    if (i === userIds.length - 1) {
      splits[userId] = parseFloat((total - running).toFixed(2));
    } else {
      splits[userId] = perPerson;
      running = parseFloat((running + perPerson).toFixed(2));
    }
  });

  return splits;
}
