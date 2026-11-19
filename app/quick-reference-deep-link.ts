/**
 * Quick-reference cards are entries inside a `/reference/<slug>` page, not pages of their own.
 * A canonical learning link `/reference/<slug>?topic=<id>[&track=<id>]` opens one of them: `topic`
 * is the card's catalog id (what retrieval links carry) or its rendered element id, and `track`
 * picks between cards that share a catalog id in different tracks.
 */
export type DeepLinkableReferenceCard = Readonly<{
  /** The rendered element id, unique on the page. */
  id: string;
  /** The id of the card in its source catalog. */
  sourceId?: string;
  /** The learning track the card belongs to, when the page has tracks. */
  track?: string;
}>;

export function referenceCardForTopic<Card extends DeepLinkableReferenceCard>(
  cards: readonly Card[],
  topic: string | null | undefined,
  track?: string | null,
): Card | undefined {
  const wanted = topic?.trim();
  if (!wanted) return undefined;
  const rendered = cards.find((card) => card.id === wanted);
  if (rendered) return rendered;
  const requestedTrack = track?.trim() || undefined;
  const candidates = cards.filter((card) => card.sourceId === wanted && (!requestedTrack || !card.track || card.track === requestedTrack));
  return candidates.find((card) => card.track === requestedTrack) ?? candidates[0];
}
