"use client";

import { useEffect, useState } from "react";

import { cacheMealPhoto, getCachedMealPhoto } from "@/lib/photo-cache";
import { cn } from "@/lib/utils";

/**
 * Meal thumbnail with a local-first photo pipeline.
 *
 * - With a `photoUrl`: serve from the IndexedDB cache when possible, else
 *   fetch the blob once and prime the cache for next time.
 * - The emoji fallback renders immediately (zero layout shift) and the photo
 *   swaps in on top when ready; any failure keeps the fallback silently.
 * - Without a `photoUrl`: emoji fallback only.
 */

/** Keyword → emoji, first match wins. */
const FOOD_EMOJI: ReadonlyArray<readonly [keyword: string, emoji: string]> = [
  ["chicken", "🍗"],
  ["beef", "🥩"],
  ["steak", "🥩"],
  ["pork", "🐷"],
  ["bacon", "🥓"],
  ["rice", "🍚"],
  ["pasta", "🍝"],
  ["noodles", "🍜"],
  ["salad", "🥗"],
  ["pizza", "🍕"],
  ["egg", "🍳"],
  ["coffee", "☕"],
  ["fruit", "🍎"],
  ["soup", "🍜"],
  ["bread", "🍞"],
  ["fish", "🐟"],
  ["sushi", "🍣"],
  ["dessert", "🍰"],
  ["taco", "🌮"],
  ["curry", "🍛"],
  ["cheese", "🧀"],
  ["shrimp", "🍤"],
  ["smoothie", "🥤"],
  ["oatmeal", "🥣"],
  ["sandwich", "🥪"],
  ["wrap", "🌯"],
  ["fries", "🍟"],
];

const MEAL_TYPE_EMOJI: Record<string, string> = {
  breakfast: "🍳",
  lunch: "🍽️",
  dinner: "🍲",
  snack: "🍪",
};

function fallbackEmoji(foodName: string, mealType: string): string {
  const name = foodName.toLowerCase();
  for (const [keyword, emoji] of FOOD_EMOJI) {
    if (name.includes(keyword)) return emoji;
  }
  return MEAL_TYPE_EMOJI[mealType.toLowerCase()] ?? "🍽️";
}

export function MealPhoto({
  mealId,
  photoUrl,
  foodName,
  mealType,
  className,
}: {
  mealId: string;
  photoUrl?: string | null;
  foodName: string;
  mealType: string;
  className?: string;
}) {
  const emoji = fallbackEmoji(foodName, mealType);
  // State is stamped with the photoUrl it belongs to, so a changed prop
  // simply stops matching (stale results ignored) without resetting state
  // synchronously inside the effect.
  const [loaded, setLoaded] = useState<{
    key: string;
    objectUrl: string;
  } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!photoUrl) return;

    let cancelled = false;
    let createdUrl: string | null = null;

    void (async () => {
      let blob = await getCachedMealPhoto(mealId);
      if (!blob) {
        // Vercel Blob public URLs are CORS-readable, so a plain fetch works.
        const response = await fetch(photoUrl);
        if (!response.ok) throw new Error(`PHOTO_FETCH_${response.status}`);
        blob = await response.blob();
        if (!cancelled && blob.size > 0) {
          void cacheMealPhoto(mealId, blob);
        }
      }
      return URL.createObjectURL(blob);
    })()
      .then((objectUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        createdUrl = objectUrl;
        setLoaded({ key: photoUrl, objectUrl });
      })
      .catch(() => {
        if (!cancelled) setFailedKey(photoUrl);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [mealId, photoUrl]);

  const failed = failedKey === photoUrl;
  const showPhoto = !failed && loaded !== null && loaded.key === photoUrl;

  return (
    <span title={foodName} className={cn("relative block overflow-hidden bg-accent/60", className)}>
      {/* Fallback paints instantly; the photo fades in over it when ready.
          Emoji inherits the font-size — tune via className (e.g. text-2xl). */}
      <span aria-hidden="true" className="grid size-full place-items-center leading-none">
        {emoji}
      </span>
      {showPhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={loaded.objectUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
