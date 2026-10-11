import { useLocale } from 'next-intl';
import { useMemo } from 'react';
import { describeProject, projectKind, projectTitle } from './descriptors';
import { industryLabel, locationLabel, platformLabel, toDescriptorLocale, type DescriptorLocale, type PlatformId } from './labels';
import type { LabProject } from './portfolio';

type Described = Pick<LabProject, 'slug' | 'type' | 'description' | 'platforms'>;

/** The page's words for a portfolio project, in the current locale. */
export interface ProjectDescriber {
  locale: DescriptorLocale;
  /** "messenger app" / "мессенджер" / "messenjer": lowercase, no article. */
  kind: (project: Described) => string;
  /** "Messenger app": sentence case, for labels and headings. */
  title: (project: Described) => string;
  /** Inside a sentence: "a messenger app" (en), "мессенджер" (ru), "messenjer" (uz). */
  describe: (project: Described, options?: { isCapitalized?: boolean }) => string;
  /** "USA" / "США" / "AQSh". */
  location: (project: Pick<LabProject, 'location'>) => string;
  /** The industry (`project.type`): "FinTech" / "Финтех" / "Fintex". */
  industry: (project: Pick<LabProject, 'type'>) => string;
  /** "Web" / "Веб" / "Veb". */
  platform: (platform: PlatformId) => string;
  /** "iOS · Android · Web", localized, joined with `separator`. */
  platforms: (project: Pick<LabProject, 'platforms'>, separator?: string) => string;
  /** The project's full description from src/shared/data/projects.ts. */
  description: (project: Pick<LabProject, 'descriptions'>) => string;
}

/**
 * Locale-bound descriptors for any section:
 *
 *   const describe = useProjectDescriber();
 *   describe.title(project)     // "Мессенджер"
 *   describe.location(project)  // "США"
 *
 * Pass the result's strings into messages as ICU arguments
 * (`t('nextLabel', { description: describe.describe(project) })`).
 */
export function useProjectDescriber(): ProjectDescriber {
  const locale = toDescriptorLocale(useLocale());
  return useMemo(() => createProjectDescriber(locale), [locale]);
}

/** The same API without React, for helpers that already know the locale. */
export function createProjectDescriber(locale: DescriptorLocale): ProjectDescriber {
  return {
    locale,
    kind: project => projectKind(project, locale),
    title: project => projectTitle(project, locale),
    describe: (project, options = {}) => describeProject(project, { ...options, locale }),
    location: project => locationLabel(project.location, locale),
    industry: project => industryLabel(project.type, locale),
    platform: platform => platformLabel(platform, locale),
    platforms: (project, separator = ' · ') => project.platforms.map(platform => platformLabel(platform, locale)).join(separator),
    description: project => project.descriptions[locale],
  };
}
