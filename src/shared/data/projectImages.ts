import type { StaticImageData } from 'next/image';

import ascon from '../../../public/images/projects/ascon.jpg';
import bdm from '../../../public/images/projects/bdm.jpg';
import drivemeDriver from '../../../public/images/projects/driveme-driver.jpg';
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

import asconShot from '../../../public/images/projects/screens/ascon.webp';
import bdmShot from '../../../public/images/projects/screens/bdm.webp';
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
 * the project `name` in src/shared/data/projects.ts. Projects without an
 * entry get an initials badge in the slider.
 */
export const projectVisuals: Record<string, ProjectVisual> = {
  'Talim AI': { src: talimIcon, screenshot: talimShot },
  DriveMe: { src: driveme },
  'DriveMe Driver': { src: drivemeDriver },
  Netevia: { src: netevia, screenshot: neteviaShot },
  'Truck Me': { src: truckme },
  'VBrato & SwishSportsApp': { src: swish, screenshot: swishShot },
  HeyAll: { src: heyall, screenshot: heyallShot },
  WorkAxle: { src: workaxle, screenshot: workaxleShot },
  EDOCS: { src: edocs },
  BDM: { src: bdm, screenshot: bdmShot },
  ASCON: { src: ascon, screenshot: asconShot },
  'Nestegg.ai': { src: nestegg, wide: true },
  'Nestegg Loan': { src: nestegg, wide: true },
};
