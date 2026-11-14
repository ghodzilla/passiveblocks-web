import replayJson from '../../research/regime-validation/replay-results.json';
import studyJson from '../../research/regime-validation/results.json';
import vintageJson from '../../research/regime-validation/vintage-replay.json';
import type { VintageReplay } from './vintageReplay';

/**
 * Build-time copies of the research files the owner page renders.
 * The price book and the ALFRED archive stay out of this module. A runtime
 * readFileSync does not survive Vercel file tracing, so the page imports these values instead.
 */
export const validationStudy = studyJson;
export const replayResults = replayJson;
export const vintageReplay = vintageJson as VintageReplay;
