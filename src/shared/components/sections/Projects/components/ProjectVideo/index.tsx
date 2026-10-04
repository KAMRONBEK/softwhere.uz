'use client';
import { useEffect, useRef, useState } from 'react';

import { logDebug } from '@/core/logger';
import css from './style.module.css';

interface ProjectVideoProps {
  src: string;
  poster: string;
  label: string;
  /** True while this project's slide is the selected one. */
  active: boolean;
  onEnded: () => void;
}

/** Share of the video that must be on screen before it plays (also keeps react-slick's off-screen clones silent). */
const VISIBLE_THRESHOLD = 0.5;

/** Muted walkthrough that plays only while its slide is active and visible, and reports when it finishes. */
function ProjectVideo({ src, poster, label, active, onEnded }: ProjectVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: VISIBLE_THRESHOLD });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  // Browsers abort play() in background tabs; retry once the tab is shown again (and pause while hidden).
  useEffect(() => {
    const syncPageVisibility = () => setIsPageVisible(document.visibilityState === 'visible');
    syncPageVisibility();
    document.addEventListener('visibilitychange', syncPageVisibility);
    return () => document.removeEventListener('visibilitychange', syncPageVisibility);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (active && isVisible && isPageVisible && !prefersReducedMotion) {
      video.play().catch(error => {
        // Autoplay can be refused (e.g. data-saver); the poster and native controls remain usable.
        logDebug('Portfolio video autoplay was blocked', { src, error: String(error) }, 'ProjectVideo');
      });
      return;
    }
    video.pause();
    if (!active) video.currentTime = 0;
  }, [active, isVisible, isPageVisible, src]);

  return (
    <video
      ref={videoRef}
      className={css.video}
      src={src}
      poster={poster}
      aria-label={label}
      // Visibility gates preload too, so react-slick's off-screen clone of the active slide never downloads a second copy.
      preload={active && isVisible ? 'auto' : 'none'}
      muted
      playsInline
      controls
      onEnded={onEnded}
    />
  );
}

export default ProjectVideo;
