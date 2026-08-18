export function spn2freq(spn) {
    if (__DEV__) {
        if (typeof spn !== 'string') {
            throw new TypeError(`SPN must be a string: ${spn}`);
        }
        if (!spn.match(/^[A-G]#?\d$/)) {
            throw new Error(`Invalid SPN format: ${spn}`);
        }
    }
    const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    let noteName = spn.slice(0, -1);
    let octaveNum = Number(spn.slice(-1));
    let aFreq = 27.5 * 2 ** octaveNum;
    let pitchClass = NOTES.indexOf(noteName);
    const FREQ_INTERVAL = 2 ** (1 / 12);
    return aFreq * FREQ_INTERVAL ** (pitchClass - 9);
}
