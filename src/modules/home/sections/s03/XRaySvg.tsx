import { boxCorners, estimateText, layoutCodeCard, quadAngle, quadCenter, quadSize, type OverlayMetrics } from './geometry';
import { tokenColor, tokenizeLine, type XRayPalette } from './palette';
import type { Quad, XRayScene } from './scenes';

/**
 * The overlay as SVG in the frame's logical space (viewBox = 1200×800), for
 * the CSS-only lens on low-tier devices and without WebGL. It sits in the
 * same transformed plane as the still, and mirrors overlay.ts closely enough
 * to read as the same blueprint.
 */

interface XRaySvgProps {
  scene: XRayScene;
  palette: XRayPalette;
  sizes: OverlayMetrics;
  className?: string;
}

const points = (quad: Quad) => quad.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
const deg = (rad: number) => (rad * 180) / Math.PI;
/** Proportional-font estimate for the captions. */
const captionWidth = (text: string, size: number) => text.length * size * 0.56;

export default function XRaySvg({ scene, palette, sizes, className }: XRaySvgProps) {
  const [w, h] = scene.size;
  const { px, label: labelSize, code: codeSize, caption: captionSize } = sizes;
  const chipH = labelSize * 1.45;
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} aria-hidden='true' focusable='false'>
      <g fontFamily={palette.mono}>
        {scene.screens.map(screen => (
          <polygon
            key={screen.name}
            points={points(screen.quad)}
            fill='none'
            stroke={palette.isDark ? palette.accent2 : palette.ink}
            strokeOpacity={0.85}
            strokeWidth={1.25 * px}
            strokeDasharray={`${5 * px} ${4 * px}`}
          />
        ))}
        {scene.screens.flatMap(screen =>
          screen.parts.map(part => {
            const corners = boxCorners(screen.quad, part.box);
            const angle = deg(quadAngle(screen.quad));
            const tagWidth = estimateText(part.tag, labelSize) + 8 * px;
            const shape =
              part.shape === 'circle' ? (
                <circle cx={quadCenter(corners)[0]} cy={quadCenter(corners)[1]} r={quadSize(corners).width / 2} />
              ) : (
                <polygon points={points(corners)} />
              );
            return (
              <g key={`${screen.name}-${part.id}`}>
                <g fill={palette.accent} fillOpacity={palette.isDark ? 0.1 : 0.08} stroke={palette.accent} strokeWidth={1.25 * px}>
                  {shape}
                </g>
                <g transform={`translate(${corners[0][0]} ${corners[0][1]}) rotate(${angle})`}>
                  <rect x={3 * px} y={3 * px} width={tagWidth} height={chipH} fill={palette.accent} />
                  <text
                    x={7 * px}
                    y={3 * px + chipH / 2}
                    dominantBaseline='central'
                    fontSize={labelSize}
                    fontWeight={500}
                    fill={palette.onAccent}
                  >
                    {part.tag}
                  </text>
                </g>
              </g>
            );
          })
        )}
        {scene.screens.flatMap(screen =>
          screen.code.map(code => {
            const layout = layoutCodeCard(screen, code, codeSize, captionSize, estimateText);
            const { origin, angle, width, height, pad, lineHeight, fontSize, captionHeight, captionGap } = layout;
            const captionPadX = captionSize * 0.62;
            return (
              <g key={`${screen.name}-${code.file}`} transform={`translate(${origin[0]} ${origin[1]}) rotate(${deg(angle)})`}>
                <rect
                  y={-captionHeight - captionGap}
                  width={captionWidth(code.caption, captionSize) + captionPadX * 2}
                  height={captionHeight}
                  rx={Math.min(palette.radius * px, captionHeight / 2)}
                  fill={palette.accent}
                />
                <text
                  x={captionPadX}
                  y={-captionGap - captionHeight / 2}
                  dominantBaseline='central'
                  fontFamily={palette.body}
                  fontSize={captionSize}
                  fontWeight={600}
                  fill={palette.onAccent}
                >
                  {code.caption}
                </text>
                <rect
                  width={width}
                  height={height}
                  rx={palette.radius * px}
                  fill={palette.card}
                  stroke={palette.ink}
                  strokeOpacity={0.16}
                  strokeWidth={px}
                />
                <text x={pad} y={pad + lineHeight / 2} dominantBaseline='central' fontSize={fontSize * 0.86} fill={palette.muted}>
                  {code.file}
                </text>
                {code.lines.map((line, index) => (
                  <text
                    key={index}
                    x={pad}
                    y={pad + lineHeight * (index + 1.5) + fontSize * 0.35}
                    dominantBaseline='central'
                    fontSize={fontSize}
                    style={{ whiteSpace: 'pre' }}
                  >
                    {tokenizeLine(line).map((token, i) => (
                      <tspan key={i} fill={tokenColor(palette, token.kind)}>
                        {token.text}
                      </tspan>
                    ))}
                  </text>
                ))}
              </g>
            );
          })
        )}
      </g>
    </svg>
  );
}
