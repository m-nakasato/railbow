import { play } from './play.mjs';
import { getPlaytime } from './getPlaytime.mjs';

export const loop = (synthesizers, playbackData, kms) => {
    let nextStartTime = play(synthesizers, playbackData, kms.seq);
    const playtime = getPlaytime(kms);
    console.log('playtime:', playtime, 'sec');
    return setInterval(
        () => {
            nextStartTime = play(synthesizers, playbackData, kms.seq, kms.loop, nextStartTime);
        },
        (playtime - 1) * 1000,
    );
};
