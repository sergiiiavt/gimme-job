export function referenceCardForTopic<Card extends Readonly<{ id: string; sourceId?: string; track?: string }>>(
  cards: readonly Card[],
  topic: string | null | undefined,
  track?: string | null,
): Card | undefined {
  // A canonical learning link `/reference/<slug>?topic=<id>[&track=<id>]` opens one card of the page:
  // `topic` is the card's catalog id (`sourceId`, what retrieval links carry) or its rendered element
  // id (`id`, unique on the page), and `track` picks between cards sharing a catalog id across tracks.
  const wanted = topic?.trim();
  if (!wanted) return undefined;
  const rendered = cards.find((card) => card.id === wanted);
  if (rendered) return rendered;
  const requestedTrack = track?.trim() || undefined;
  const candidates = cards.filter((card) => card.sourceId === wanted && (!requestedTrack || !card.track || card.track === requestedTrack));
  return candidates.find((card) => card.track === requestedTrack) ?? candidates[0];
}
