import { createParser } from './createParser.mjs';
import { buildEvent } from './buildEvent.mjs';

export const parse = (kms) => {
    const parseEvent = createParser(',');
    const parseMeasure = createParser(' ', '+', parseEvent);
    const parseTrack = createParser('|', '%', parseMeasure);

    return kms.track.map((trackString, tid) =>
        parseTrack(trackString).map((measure) =>
            measure.map((event) => buildEvent(event, kms.bpm, kms.opt[tid], kms.value)),
        ),
    );
};
