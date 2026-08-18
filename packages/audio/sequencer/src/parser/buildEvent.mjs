import { duration } from './duration.mjs';

export const buildEvent = (event, bpm, opt, defaultValue = '8') => {
    const dur = duration(event[1] ?? defaultValue, bpm);
    if (event[0] == '_') return ['_', { dur }];
    return [event[0] * 1, { dur, ...opt[event[2] ?? 0] }];
};
