import { Card } from '@/shared/components/site';
import { CoverImage } from '@/shared/types';
import PostCover from './PostCover';
import css from './blog.module.css';

interface PostCardProps {
  title: string;
  slug: string;
  locale: string;
  coverImage?: CoverImage;
  as?: 'h2' | 'h3';
  category?: string;
  date?: { iso: string; text: string };
  /** The list's opening card: full width, picture beside the text. */
  isLead?: boolean;
  /** The photographer's credit on the picture (Unsplash asks for it). */
  hasCredit?: boolean;
  isPriority?: boolean;
}

const GRID_SIZES = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';
const LEAD_SIZES = '(max-width: 900px) 100vw, 60vw';

/** A post in a list: the site's card with a picture on top. */
export default function PostCard({ title, slug, locale, coverImage, as, category, date, isLead, hasCredit, isPriority }: PostCardProps) {
  const credit =
    hasCredit && coverImage ? (
      // Above the card's stretched link, so the credit stays clickable.
      <span className={css.credit}>
        Photo by{' '}
        <a href={`${coverImage.authorUrl}?utm_source=softwhere&utm_medium=referral`} target='_blank' rel='noopener noreferrer'>
          {coverImage.authorName}
        </a>
      </span>
    ) : undefined;
  const media = (
    <PostCover
      src={coverImage?.thumbUrl}
      alt={title}
      seed={slug}
      sizes={isLead ? LEAD_SIZES : GRID_SIZES}
      isPriority={isPriority}
      credit={credit}
    />
  );
  const meta =
    category || date ? (
      <span className={css.cardMeta}>
        {category ? <span className={css.category}>{category}</span> : null}
        {date ? <time dateTime={date.iso}>{date.text}</time> : null}
      </span>
    ) : undefined;

  return (
    <Card
      title={title}
      href={`/${locale}/blog/${slug}`}
      as={as}
      meta={meta}
      media={media}
      className={isLead ? `${css.postCard} ${css.lead}` : css.postCard}
    />
  );
}
