"use client";

import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  onRatingChangeAction?: (rating: number) => void;
  maxStars?: number;
}

export function StarRating({
  rating,
  onRatingChangeAction,
  maxStars = 5,
}: StarRatingProps) {
  const handleStarClick = (index: number) => {
    if (onRatingChangeAction) {
      onRatingChangeAction(index);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxStars }).map((_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => handleStarClick(index + 1)}
          className="focus:outline-none"
          aria-label={`Rate ${index + 1} out of ${maxStars} stars`}
        >
          <StarIcon
            className={cn(
              "size-8 cursor-pointer transition-all",
              index < rating
                ? "fill-yellow-400 text-yellow-400"
                : "fill-transparent text-gray-300 hover:text-gray-400"
            )}
          />
        </button>
      ))}
      <span className="text-muted-foreground ml-2 text-sm">
        {rating > 0 ? `${rating} out of ${maxStars}` : "No rating selected"}
      </span>
    </div>
  );
}
