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
import truckme from '../../../public/images/projects/truckme.jpg';
import workaxle from '../../../public/images/projects/workaxle.jpg';

export interface ProjectVisual {
  src: StaticImageData;
  /** Wide wordmark/logo (rendered at natural aspect) vs square app icon. */
  wide?: boolean;
}

/**
 * App icons per project (512x512 from the founder's portfolio site), keyed by
 * the project `name` in src/shared/data/projects.ts. Projects without an
 * entry get an initials badge in the slider.
 */
export const projectVisuals: Record<string, ProjectVisual> = {
  DriveMe: { src: driveme },
  'DriveMe Driver': { src: drivemeDriver },
  Netevia: { src: netevia },
  'Truck Me': { src: truckme },
  'VBrato & SwishSportsApp': { src: swish },
  HeyAll: { src: heyall },
  WorkAxle: { src: workaxle },
  EDOCS: { src: edocs },
  BDM: { src: bdm },
  ASCON: { src: ascon },
  'Nestegg.ai': { src: nestegg, wide: true },
  'Nestegg Loan': { src: nestegg, wide: true },
};
