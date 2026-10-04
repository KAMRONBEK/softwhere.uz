import { Img, staticFile } from 'remotion';

type Props = {
  src: string;
  width: number;
  height: number;
  /** Image height / width. */
  aspect: number;
  /** 0 = top, 1 = bottom. Only moves when the image overflows the box. */
  scrollProgress?: number;
};

/** Covers a box with an image, top-aligned; pans down via scrollProgress when the image is taller. */
export const ScreenImage = ({ src, width, height, aspect, scrollProgress = 0 }: Props) => {
  const displayWidth = Math.max(width, height / aspect);
  const displayHeight = displayWidth * aspect;
  const overflow = Math.max(0, displayHeight - height);

  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden' }}>
      <Img
        src={staticFile(src)}
        style={{
          position: 'absolute',
          left: (width - displayWidth) / 2,
          top: -overflow * scrollProgress,
          width: displayWidth,
          height: displayHeight,
        }}
      />
    </div>
  );
};
