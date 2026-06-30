import type { ProductStoryContent } from "./pdp-story";
import { StoryBenefitHero } from "./story-benefit-hero";
import { StorySplit2Up } from "./story-split-2up";
import { StoryWideBanner } from "./story-wide-banner";

interface ProductStorySectionsProps {
  story: ProductStoryContent;
}

/**
 * ProductStorySections — maps the per-category story model onto the reusable
 * layout components (benefit hero, split 2-up, wide banner) in order. The
 * structure is generic for every category; only the content differs.
 */
export function ProductStorySections({ story }: ProductStorySectionsProps) {
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
