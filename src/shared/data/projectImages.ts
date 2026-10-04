import type { StaticImageData } from 'next/image';

import ascon from '../../../public/images/projects/ascon.jpg';
import bdm from '../../../public/images/projects/bdm.jpg';
import driveme from '../../../public/images/projects/driveme.jpg';
import edocs from '../../../public/images/projects/edocs.jpg';
import heyall from '../../../public/images/projects/heyall.jpg';
import nestegg from '../../../public/images/projects/nestegg.jpg';
import netevia from '../../../public/images/projects/netevia.jpg';
import swish from '../../../public/images/projects/swish.jpg';
import talimIcon from '../../../public/images/projects/talim-ai.svg';
import talimShot from '../../../public/images/projects/screens/talim-ai.webp';
import truckme from '../../../public/images/projects/truckme.jpg';
import workaxle from '../../../public/images/projects/workaxle.jpg';

import heyallShot from '../../../public/images/projects/screens/heyall.webp';
import neteviaShot from '../../../public/images/projects/screens/netevia.webp';
import swishShot from '../../../public/images/projects/screens/swish.webp';
import workaxleShot from '../../../public/images/projects/screens/workaxle.webp';

export interface ProjectVisual {
  src: StaticImageData;
  /** Wide wordmark/logo (rendered at natural aspect) vs square app icon. */
  wide?: boolean;
  /** Real App Store screenshot (from Apple's public lookup API). */
  screenshot?: StaticImageData;
}

/**
 * App icons per project (512x512 from the founder's portfolio site), keyed by
 * the project `name` in src/shared/data/projects.ts. Only shown when a project
 * has no walkthrough video; projects without an entry get an initials badge.
 */
export const projectVisuals: Record<string, ProjectVisual> = {
  'Talim AI': { src: talimIcon, screenshot: talimShot },
  DriveMe: { src: driveme },
  Netevia: { src: netevia, screenshot: neteviaShot },
  'Truck Me': { src: truckme },
  'Swish Sports': { src: swish, screenshot: swishShot },
  HeyAll: { src: heyall, screenshot: heyallShot },
  WorkAxle: { src: workaxle, screenshot: workaxleShot },
  EDOCS: { src: edocs },
  BDM: { src: bdm },
  ASCON: { src: ascon },
  NestEgg: { src: nestegg, wide: true },
};
