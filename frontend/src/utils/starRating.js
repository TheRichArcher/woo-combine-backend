const STAR_BANDS = [
  { min: 90, max: 100, starCount: 5, starLabel: 'Elite' },
  { min: 75, max: 89, starCount: 4, starLabel: 'Impact Player' },
  { min: 50, max: 74, starCount: 3, starLabel: 'Reliable Starter' },
  { min: 25, max: 49, starCount: 2, starLabel: 'Mid-Major Contributor' },
  { min: 0, max: 24, starCount: 1, starLabel: 'Developmental Prospect' }
];

function normalizePercentile(percentile) {
  const numeric = Number(percentile);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function getStarRatingFromPercentile(percentile) {
  const normalizedPercentile = normalizePercentile(percentile);
  if (normalizedPercentile === null) {
    return {
      percentile: null,
      starCount: null,
      starLabel: '',
      starDisplay: ''
    };
  }

  const band =
    STAR_BANDS.find(
      ({ min, max }) => normalizedPercentile >= min && normalizedPercentile <= max
    ) || STAR_BANDS[STAR_BANDS.length - 1];

  const starDisplay = '★'.repeat(band.starCount);

  return {
    percentile: normalizedPercentile,
    starCount: band.starCount,
    starLabel: band.starLabel,
    starDisplay
  };
}

export function getPercentileFromRank(rank, total) {
  const numericRank = Number(rank);
  const numericTotal = Number(total);
  if (!Number.isFinite(numericRank) || !Number.isFinite(numericTotal) || numericTotal <= 0) {
    return null;
  }
  const clampedRank = Math.max(1, Math.min(numericTotal, Math.round(numericRank)));
  return Math.round(((numericTotal - clampedRank + 1) / numericTotal) * 100);
}

export function getStarRatingFromRank(rank, total) {
  const percentile = getPercentileFromRank(rank, total);
  return getStarRatingFromPercentile(percentile);
}

export function attachStarRatingsByComposite(players = []) {
  if (!Array.isArray(players) || players.length === 0) return [];

  const toCompositeNumber = (player) => {
    const raw = player?.composite_score ?? player?.scores?.composite;
    if (raw === null || raw === undefined || raw === '') return NaN;
    return Number(raw);
  };

  const withComposite = players
    .map((player) => ({
      id: player?.id,
      compositeScore: toCompositeNumber(player)
    }))
    .filter((entry) => entry.id && Number.isFinite(entry.compositeScore))
    .sort((a, b) => b.compositeScore - a.compositeScore);

  const totalRanked = withComposite.length;
  const percentileById = new Map(
    withComposite.map((entry, index) => {
      const percentile = getPercentileFromRank(index + 1, totalRanked);
      return [entry.id, percentile];
    })
  );

  return players.map((player) => {
    const draftPercentile = percentileById.get(player?.id) ?? null;
    const draftStar = getStarRatingFromPercentile(draftPercentile);
    return {
      ...player,
      draftPercentile,
      draftStarCount: draftStar.starCount,
      draftStarLabel: draftStar.starLabel,
      draftStarDisplay: draftStar.starDisplay
    };
  });
}

export const STAR_RATING_BANDS = STAR_BANDS;
