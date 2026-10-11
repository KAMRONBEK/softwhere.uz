/** SoftWhere orange, from public/icons/logo.svg. */
export const BRAND_ORANGE = '#fe4502';

/**
 * The custom property the mark paints with, falling back to --accent. The lab
 * root sets it to BRAND_ORANGE while the panel's Logo color is "Brand
 * orange"; a section re-inks the mark on an accent fill by overriding it.
 */
export const LOGO_INK = 'var(--logo-ink, var(--accent))';
