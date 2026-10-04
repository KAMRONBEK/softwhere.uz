import type { Side } from '../components/Caption';
import { VIDEO } from '../theme';

export type DeviceSlot = { centerX: number; scale: number; rotate: number; z: number };

export const MOBILE_CAPTION = { width: 620, gutter: 120 } as const;
export const DEVICE_HEIGHT = { single: 820, spread: 770 } as const;

const REGION_GAP = 80;
const SPREAD_OFFSET = { two: 190, three: 330 } as const;

/** Horizontal centre of the area the caption leaves free. */
export const deviceRegionCenter = (captionSide: Side): number => {
  const regionWidth = VIDEO.width - MOBILE_CAPTION.gutter * 2 - MOBILE_CAPTION.width - REGION_GAP;
  const fromLeft = MOBILE_CAPTION.gutter + MOBILE_CAPTION.width + REGION_GAP + regionWidth / 2;
  return captionSide === 'left' ? fromLeft : VIDEO.width - fromLeft;
};

/** One, two (overlapping pair) or three (fanned) device positions. */
export const deviceSlots = (count: number, captionSide: Side): DeviceSlot[] => {
  const center = deviceRegionCenter(captionSide);
  if (count === 1) {
    return [{ centerX: center, scale: 1, rotate: 0, z: 2 }];
  }
  if (count === 2) {
    return [
      { centerX: center - SPREAD_OFFSET.two, scale: 0.94, rotate: -4, z: 1 },
      { centerX: center + SPREAD_OFFSET.two, scale: 1, rotate: 3, z: 2 },
    ];
  }
  return [
    { centerX: center - SPREAD_OFFSET.three, scale: 0.84, rotate: -7, z: 1 },
    { centerX: center, scale: 1, rotate: 0, z: 3 },
    { centerX: center + SPREAD_OFFSET.three, scale: 0.84, rotate: 7, z: 1 },
  ];
};
