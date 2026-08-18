export function num2freq(noteNumber) {
    if (__DEV__) {
        if (typeof noteNumber !== 'number') {
            throw new TypeError(`Input must be a number: ${noteNumber}`);
        }
        if (noteNumber < 0 || noteNumber > 127) {
            throw new RangeError(`MIDI note number must be between 0 and 127: ${noteNumber}`);
        }
    }
    return 55 * 2 ** ((noteNumber - 33) / 12);
}
