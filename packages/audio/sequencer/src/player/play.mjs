export const play = (synthesizers, playbackData, seq, startSeq = 0, startTime = 0) => {
    let end = 0;
    playbackData.forEach((track, tid) => {
        let nextTime = startTime;
        for (let i = startSeq; i < seq.length; i++) {
            track[seq[i]].forEach((event) => {
                if (event[0] != '_') {
                    if (nextTime != 0) event[1].sta = nextTime;
                    nextTime = synthesizers[tid].play(...event).end;
                } else {
                    nextTime += event[1].dur;
                }
            });
        }
        if (end < nextTime) end = nextTime;
    });
    return end;
};
