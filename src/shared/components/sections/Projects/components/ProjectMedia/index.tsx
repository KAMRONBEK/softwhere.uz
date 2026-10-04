import Image from 'next/image';

import { projectVisuals } from '@/shared/data/projectImages';
import type { Project } from '@/shared/types';
import ProjectVideo from '../ProjectVideo';
import css from '../ProjectSlider/style.module.css';

interface ProjectMediaProps {
  project: Project;
  active: boolean;
  videoLabel: string;
  onVideoEnded: () => void;
}

/** "Align 360" -> "A3", "NAFT" -> "N" — fallback badge for icon-less projects. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Right-hand visual of a portfolio slide: walkthrough video, else screenshot + icon badge, icon, or initials. */
function ProjectMedia({ project, active, videoLabel, onVideoEnded }: ProjectMediaProps) {
  if (project.video) {
    return (
      <div data-aos='fade-up-left' className={css.videoWrap}>
        <ProjectVideo src={project.video.src} poster={project.video.poster} label={videoLabel} active={active} onEnded={onVideoEnded} />
      </div>
    );
  }

  const visual = projectVisuals[project.name];
  return (
    <div data-aos='fade-up-left' className={css.iconWrap}>
      {visual?.screenshot ? (
        <>
          <Image className={css.screenshot} src={visual.screenshot} alt={`${project.name} app screenshot`} />
          <Image className={css.iconBadge} src={visual.src} alt='' />
        </>
      ) : visual ? (
        <Image className={visual.wide ? css.appLogo : css.appIcon} src={visual.src} alt={`${project.name} app icon`} />
      ) : (
        <span className={css.initials} aria-hidden='true'>
          {initialsOf(project.name)}
        </span>
      )}
    </div>
  );
}

export default ProjectMedia;
