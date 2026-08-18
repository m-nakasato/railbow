import test from 'node:test';
import assert from 'node:assert/strict';
// import util from 'node:util';
import { spn2freq } from '../../src/utils/spn2freq.mjs';

global.__DEV__ = true;

test('spn2freq normal cases', t => {
    t.test('A4 -> 440Hz', () => {
        assert.strictEqual(spn2freq('A4'), 440);
    });

    t.test('C4 -> 261.63Hz', () => {
        assert.ok(Math.abs(spn2freq('C4') - 261.6255653005986) < 0.0001);
    });
});

test('spn2freq invalid input', t => {
    t.test('undefined', () => {
        assert.throws(() => spn2freq(), /SPN must be a string: undefined/);
    });

    t.test('null', () => {
        assert.throws(() => spn2freq(null), /SPN must be a string: null/);
    });

    t.test('Numeric note name', () => {
        assert.throws(() => spn2freq(0), /SPN must be a string: 0/);
    });

    t.test('Empty string', () => {
        assert.throws(() => spn2freq(''), /Invalid SPN format: /);
    });

    t.test('Invalid note name', () => {
        assert.throws(() => spn2freq('H4'), /Invalid SPN format: H4/);
    });

    t.test('Missing octave number', () => {
        assert.throws(() => spn2freq('C'), /Invalid SPN format: C/);
    });

    t.test('Incorrect sharp position', () => {
        assert.throws(() => spn2freq('C4#'), /Invalid SPN format: C4#/);
    });

    t.test('Non-numeric octave', () => {
        assert.throws(() => spn2freq('C#X'), /Invalid SPN format: C#X/);
    });
});

test('spn2freq edge cases', t => {
    t.test('Lowest valid note A0', () => {
        assert.strictEqual(spn2freq('A0'), 27.5);
    });

    t.test('Highest valid note C8', () => {
        assert.ok(Math.abs(spn2freq('C8') - 4186.009044809578) < 0.0001);
    });
});

// test('spn2freq enharmonic equivalents', (t) => {
//     t.test('C#4 and Db4', () => {
//         assert.strictEqual(spn2freq('C#4'), spn2freq('Db4'));
//     });

//     t.test('D#4 and Eb4', () => {
//         assert.strictEqual(spn2freq('D#4'), spn2freq('Eb4'));
//     });

//     t.test('F#4 and Gb4', () => {
//         assert.strictEqual(spn2freq('F#4'), spn2freq('Gb4'));
//     });

//     t.test('G#4 and Ab4', () => {
//         assert.strictEqual(spn2freq('G#4'), spn2freq('Ab4'));
//     });

//     t.test('A#4 and Bb4', () => {
//         assert.strictEqual(spn2freq('A#4'), spn2freq('Bb4'));
//     });
// });

// test('spn2freq octave transitions', (t) => {
//     t.test('B3 to C4 transition', () => {
//         const freqB3 = spn2freq('B3');
//         const freqC4 = spn2freq('C4');
//         assert.ok(freqC4 > freqB3, 'C4 should be higher in frequency than B3');
//     });

//     t.test('E4 to F4 transition', () => {
//         const freqE4 = spn2freq('E4');
//         const freqF4 = spn2freq('F4');
//         assert.ok(freqF4 > freqE4, 'F4 should be higher in frequency than E4');
//     });
// });

// test('spn2freq frequency ratios', (t) => {
//     t.test('Octave ratio (A4 to A5)', () => {
//         const freqA4 = spn2freq('A4');
//         const freqA5 = spn2freq('A5');
//         assert.strictEqual(freqA5 / freqA4, 2, 'Frequency ratio of an octave should be 2');
//     });

//     t.test('Perfect fifth ratio (C4 to G4)', () => {
//         const freqC4 = spn2freq('C4');
//         const freqG4 = spn2freq('G4');
//         const ratio = freqG4 / freqC4;
//         assert.ok(Math.abs(ratio - 1.5) < 0.0001, 'Frequency ratio of a perfect fifth should be approximately 1.5');
//     });
// });

// test('spn2freq consistency across octaves', (t) => {
//     const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

//     notes.forEach((note) => {
//         t.test(`Consistency of ${note} across octaves`, () => {
//             const freqOctave3 = spn2freq(`${note}3`);
//             const freqOctave4 = spn2freq(`${note}4`);
//             const freqOctave5 = spn2freq(`${note}5`);

//             assert.ok(Math.abs((freqOctave4 / freqOctave3) - 2) < 0.0001, `${note}4 should be double the frequency of ${note}3`);
//             assert.ok(Math.abs((freqOctave5 / freqOctave4) - 2) < 0.0001, `${note}5 should be double the frequency of ${note}4`);
//         });
//     });
// });

// test('spn2freq sharp and flat notation', (t) => {
//     t.test('C#4 equals Db4', () => {
//         assert.strictEqual(spn2freq('C#4'), spn2freq('Db4'));
//     });

//     t.test('D#4 equals Eb4', () => {
//         assert.strictEqual(spn2freq('D#4'), spn2freq('Eb4'));
//     });

//     t.test('F#4 equals Gb4', () => {
//         assert.strictEqual(spn2freq('F#4'), spn2freq('Gb4'));
//     });

//     t.test('G#4 equals Ab4', () => {
//         assert.strictEqual(spn2freq('G#4'), spn2freq('Ab4'));
//     });

//     t.test('A#4 equals Bb4', () => {
//         assert.strictEqual(spn2freq('A#4'), spn2freq('Bb4'));
//     });
// });

// test('spn2freq large octave numbers', (t) => {
//     t.test('C9 -> 8372.018454196581Hz', () => {
//         assert.strictEqual(spn2freq('C9'), 8372.018454196581);
//     });

//     t.test('A0 -> 27.5Hz', () => {
//         assert.strictEqual(spn2freq('A0'), 27.5);
//     });
// });

// test('spn2freq small octave numbers', (t) => {
//     t.test('B-1 -> 7.875Hz', () => {
//         assert.strictEqual(spn2freq('B-1'), 7.875);
//     });

//     t.test('C-1 -> 8.175798915643707Hz', () => {
//         assert.strictEqual(spn2freq('C-1'), 8.175798915643707);
//     });
// });

// test('spn2freq non-standard note names', (t) => {
//     t.test('E#4 equals F4', () => {
//         assert.strictEqual(spn2freq('E#4'), spn2freq('F4'));
//     });

//     t.test('B#3 equals C4', () => {
//         assert.strictEqual(spn2freq('B#3'), spn2freq('C4'));
//     });

//     t.test('Cb5 equals B4', () => {
//         assert.strictEqual(spn2freq('Cb5'), spn2freq('B4'));
//     });

//     t.test('Fb4 equals E4', () => {
//         assert.strictEqual(spn2freq('Fb4'), spn2freq('E4'));
//     });
// });
