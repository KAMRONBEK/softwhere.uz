import { AbsoluteFill } from 'remotion';
import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions';

type NoProps = Record<string, never>;

/**
 * Outgoing scene fades out over the first half, incoming fades in over the second half.
 * Scenes are transparent over a shared backdrop, so a plain cross-fade would stack two layouts.
 */
const FadeThrough = ({ children, presentationDirection, presentationProgress }: TransitionPresentationComponentProps<NoProps>) => {
  const opacity =
    presentationDirection === 'exiting' ? Math.max(0, 1 - presentationProgress * 2) : Math.max(0, presentationProgress * 2 - 1);
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const fadeThrough = (): TransitionPresentation<NoProps> => ({ component: FadeThrough, props: {} });
