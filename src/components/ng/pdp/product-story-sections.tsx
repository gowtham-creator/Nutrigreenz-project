import type { ProductStoryContent } from "./pdp-story";
import { StoryBenefitHero } from "./story-benefit-hero";
import { StorySplit2Up } from "./story-split-2up";
import { StoryTileRows } from "./story-tile-rows";
import { StoryWideBanner } from "./story-wide-banner";

interface ProductStorySectionsProps {
  story: ProductStoryContent;
}

/**
 * ProductStorySections — maps the per-category story model onto the reusable
 * layout components in order. Categories with finished art tiles (headline
 * typeset on the image) render as stacked StoryTileRows; the rest fall back
 * to the HTML-text section layouts until their tiles are produced.
 */
export function ProductStorySections({ story }: ProductStorySectionsProps) {
  if (story.tiles && story.tiles.length > 0) {
    return <StoryTileRows rows={story.tiles} />;
  }
  return (
    <div className="flex flex-col gap-14 md:gap-20">
      {story.sections.map((section, i) => {
        switch (section.kind) {
          case "benefit-hero":
            return <StoryBenefitHero key={i} data={section} produceIcon={story.produceIcon} />;
          case "split-2up":
            return <StorySplit2Up key={i} data={section} produceIcon={story.produceIcon} />;
          case "wide-banner":
            return <StoryWideBanner key={i} data={section} produceIcon={story.produceIcon} />;
          default: {
            // Exhaustiveness guard — a new section kind must be handled above.
            const _never: never = section;
            return _never;
          }
        }
      })}
    </div>
  );
}
