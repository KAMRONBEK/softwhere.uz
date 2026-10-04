import { Config } from '@remotion/cli/config';

// Studio / CLI defaults. scripts/render.mjs passes the same values explicitly.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
