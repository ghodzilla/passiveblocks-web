import replayJson from '../../research/regime-validation/replay-results.json';
import studyJson from '../../research/regime-validation/results.json';

/**
 * Build-time copies of the two small research files the owner page renders.
 * The price book stays out of this module. A runtime readFileSync does not
 * survive Vercel file tracing, so the page imports these values instead.
 */
export const validationStudy = studyJson;
export const replayResults = replayJson;
