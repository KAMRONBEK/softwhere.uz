import { z } from 'zod';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const captionFields = {
  title: z.string().min(1).max(60),
  body: z.string().max(140).optional(),
  seconds: z.number().min(1.5).max(12).optional(),
};

const shotSchema = z.object({
  /** Path relative to video/public. */
  src: z.string().min(1),
  /** Animate a top-to-bottom scroll when the image is taller than its frame. */
  scroll: z.boolean().optional(),
  /** Web scenes only: where the synthetic cursor clicks before the next shot, as 0–1 of the viewport. */
  cursor: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
});

const mobileSceneSchema = z.object({
  type: z.literal('mobile'),
  /** device = draw a phone around a raw screen capture; card = the shot is already a designed store frame. */
  frame: z.enum(['device', 'card']),
  shots: z.array(shotSchema).min(1).max(3),
  ...captionFields,
});

const webSceneSchema = z.object({
  type: z.literal('web'),
  /** Text shown in the browser address bar (domain + path, no protocol). */
  url: z.string().min(1).max(60),
  shots: z.array(shotSchema).min(1).max(5),
  ...captionFields,
});

const videoSceneSchema = z.object({
  type: z.literal('video'),
  frame: z.enum(['device', 'browser']),
  src: z.string().min(1),
  url: z.string().max(60).optional(),
  /** Clip height / width; defaults to a modern phone (device) or 16:10 (browser). */
  aspect: z.number().min(0.3).max(3).optional(),
  /** Seconds to skip at the start of the clip. */
  trimStart: z.number().min(0).default(0),
  playbackRate: z.number().min(0.5).max(4).default(1),
  ...captionFields,
  seconds: z.number().min(1.5).max(20),
});

export const sceneSchema = z.discriminatedUnion('type', [mobileSceneSchema, webSceneSchema, videoSceneSchema]);

export const projectSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(40),
  tagline: z.string().min(1).max(90),
  category: z.string().min(1).max(40),
  location: z.string().min(1).max(30),
  years: z.string().min(1).max(20),
  status: z.enum(['live', 'archived', 'pre-launch']),
  /** Replaces the outro's default status note for archived / pre-launch projects, e.g. "Never publicly released". */
  statusLabel: z.string().min(1).max(40).optional(),
  /** Honest framing of the studio's part, e.g. "Mobile development for a US fintech". */
  role: z.string().max(80).optional(),
  platforms: z.array(z.enum(['iOS', 'Android', 'Web', 'iPad', 'npm'])).min(1),
  tech: z.array(z.string().min(1).max(28)).min(1).max(8),
  accent: z.string().regex(HEX_COLOR),
  icon: z
    .object({
      src: z.string().min(1),
      shape: z.enum(['squircle', 'circle', 'wide']).default('squircle'),
    })
    .optional(),
  links: z
    .object({
      appStore: z.boolean().optional(),
      googlePlay: z.boolean().optional(),
      web: z.string().max(40).optional(),
    })
    .default({}),
  scenes: z.array(sceneSchema).min(1).max(14),
});

export type Shot = z.infer<typeof shotSchema>;
export type MobileScene = z.infer<typeof mobileSceneSchema>;
export type WebScene = z.infer<typeof webSceneSchema>;
export type VideoScene = z.infer<typeof videoSceneSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type ProjectConfig = z.infer<typeof projectSchema>;

export type Dimensions = { width: number; height: number };
/** Natural size of every image a config references, keyed by its src. Filled in calculateMetadata. */
export type MediaMap = Readonly<Record<string, Dimensions>>;
