'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { useInView } from '../components/useInView';
import { useReducedMotion } from '../device/useDeviceTier';
import type { LabProject } from './portfolio';

interface LabVideoProps {
  project: Pick<LabProject, 'name' | 'video' | 'poster'>;
  className?: string;
  style?: CSSProperties;
  /** Play only while on screen (default). False shows the poster only. */
  shouldPlay?: boolean;
}

/**
 * Portfolio walkthrough that behaves on phones: muted + playsInline (iOS
 * autoplay rules), preload="none" so off-screen videos cost nothing, plays
 * only while visible, pauses offscreen, and stays a still poster under
 * reduced motion.
 */
export default function LabVideo({ project, className, style, shouldPlay = true }: LabVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const isVisible = useInView(ref);
  const reducedMotion = useReducedMotion();
  const isActive = shouldPlay && isVisible && !reducedMotion;

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (isActive) {
      // Autoplay can still be refused (Low Power Mode); the poster stays up.
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [isActive]);

  return (
    <video
      ref={ref}
      className={className}
      style={style}
      src={project.video}
      poster={project.poster}
      aria-label={`${project.name} walkthrough`}
      muted
      loop
      playsInline
      preload='none'
      disablePictureInPicture
    />
  );
}
