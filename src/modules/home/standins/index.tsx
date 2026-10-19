import type { Locale } from 'next-intl';
import type { LabSlots } from '../context/LabContext';
import NumbersStandIn from './NumbersStandIn';
import ProcessStandIn from './ProcessStandIn';
import { CrmBuildStandIn, MobileBuildStandIn, RagBuildStandIn, TelegramStandIn, WebBuildStandIn } from './ServiceStandIns';
import StackStandIn from './StackStandIn';
import WorkStandIn from './WorkStandIn';

/**
 * Server-rendered content for the sections' static stand-ins (LabShell
 * `standIns`, shown by SectionFallback under the heading and summary). This
 * is what crawlers, which do not scroll, index for each section, so every
 * item mirrors words the live section itself renders: its steps, parts,
 * deliverables, projects and figures, plus a link to its service page.
 * Server components only: the copy reaches the browser as rendered markup,
 * never as client messages (sections/eagerMessages.ts stays as it is).
 */
export function homeStandIns(locale: Locale): LabSlots {
  return {
    telegram: <TelegramStandIn locale={locale} />,
    'mobile-build': <MobileBuildStandIn locale={locale} />,
    'web-build': <WebBuildStandIn locale={locale} />,
    'rag-build': <RagBuildStandIn locale={locale} />,
    'crm-build': <CrmBuildStandIn locale={locale} />,
    'work-wall': <WorkStandIn locale={locale} />,
    numbers: <NumbersStandIn locale={locale} />,
    process: <ProcessStandIn locale={locale} />,
    'stack-physics': <StackStandIn locale={locale} />,
  };
}
