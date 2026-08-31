/**
 * @param {number} noteNumber
 * @param {Object} options
 * @param {number} [options.mod]
 * @param {number} [options.sta]
 * @param {number} [options.dur]
 * @param {number} [options.vol]
 * @param {number} [options.det]
 * @param {number} [options.swp]
 * @param {number[]} [options.env]
 * @param {number[]} [options.vib]
 * @param {number[]} [options.trm]
 * @param {Array} waves
 */
function validatePlayArgs(noteNumber, options, waves) {
    if (Number.isNaN(noteNumber) || noteNumber < 0 || noteNumber > 127)
        throw new Error('Invalid note number ( ' + noteNumber + ' )');

    if (Object.keys(options).length === 0) return;

    if (options.mod != undefined) {
        if (
            Number.isInteger(options.mod) == false ||
            options.mod < 0 ||
            options.mod >= waves.length
        )
            throw new Error('Invalid mode ( ' + options.mod + ' )');
    }

    if (Number.isNaN(options.sta) || options.sta < 0)
        throw new Error('Invalid start time ( ' + options.sta + ' )');
    if (Number.isNaN(options.dur) || options.dur <= 0)
        throw new Error('Invalid duration ( ' + options.dur + ' )');
    if (Number.isNaN(options.vol) || options.vol < 0 || options.vol > 2)
        throw new Error('Invalid volume ( ' + options.vol + ' )');
    if (Number.isNaN(options.det) || options.det < -100 || options.det > 100)
        throw new Error('Invalid detune ( ' + options.det + ' )');
    if (Number.isNaN(options.swp) || options.swp < -3600 || options.swp > 3600)
        throw new Error('Invalid sweep ( ' + options.swp + ' )');
    if (options.env != undefined) {
        if (Array.isArray(options.env) == false || options.env.length > 4)
            throw new Error('Invalid envelope');
        if (options.env[0] + options.env[1] + options.env[3] > options.dur)
            throw new Error(
                'Invalid envelope (' +
                    options.env[0] +
                    ' + ' +
                    options.env[1] +
                    ' + ' +
                    options.env[3] +
                    ' > ' +
                    options.dur +
                    ')',
            );
        if (options.env[2] < 0 || options.env[2] > 1)
            throw new Error('Invalid envelope sustain level');
        options.env.forEach(value => {
            if (Number.isNaN(value) || value < 0) throw new Error('Invalid envelope value');
        });
    }
    if (options.vib != undefined) {
        if (Array.isArray(options.vib) == false || options.vib.length > 3)
            throw new Error('Invalid vibrato');
        let [depth, rate, wave] = options.vib;
        if (Number.isNaN(depth) || depth < 0 || depth > 100)
            throw new Error('Invalid vibrato depth');
        if (Number.isNaN(rate) || rate <= 0 || rate > 10) throw new Error('Invalid vibrato rate');
        if (typeof wave != 'string') throw new Error('Invalid vibrato wave');
    }
    if (options.trm != undefined) {
        if (Array.isArray(options.trm) == false || options.trm.length > 3)
            throw new Error('Invalid tremolo');
        let [depth, rate, wave] = options.trm;
        if (Number.isNaN(depth) || depth < 0 || depth > 1) throw new Error('Invalid tremolo depth');
        if (Number.isNaN(rate) || rate <= 0 || rate > 10) throw new Error('Invalid tremolo rate');
        if (typeof wave != 'string') throw new Error('Invalid tremolo wave');
    }
}

class Synthesizer {
    #audioCtx;
    #waves;
    #lfo;
    #analyserNode;
    #tasks = {};
    constructor(audioCtx, waves, lfo, analyserNode) {
        this.#audioCtx = audioCtx;
        this.#waves = waves;
        this.#lfo = lfo;
        this.#analyserNode = analyserNode;
    }
    static envelope(gain, startTime, endTime, volume, envelope) {
        let [a = 0.01, d = 0.01, s = 0.5, r = 0.01] = envelope;
        gain.setValueAtTime(0, startTime);
        gain.linearRampToValueAtTime(volume, startTime + a);
        gain.linearRampToValueAtTime(volume * s, startTime + a + d);
        gain.setValueAtTime(volume * s, endTime - r);
        gain.linearRampToValueAtTime(0, endTime);
    }
    play(noteNumber, options = {}) {
        validatePlayArgs(noteNumber, options, this.#waves);

        const {
            'mod': mode = 0,
            'sta': startTime = this.#audioCtx.currentTime,
            'dur': duration = 0.03,
            'vol': volume = 1,
            'det': detune = 0,
            'swp': sweep = 0,
            'env': envelope = [],
            'vib': vibrato,
            'trm': tremolo,
        } = options;

        let endTime = startTime + duration;
        let src = this.#waves[mode].getSourceNode(noteNumber);
        src.detune.value = detune;
        src.detune.linearRampToValueAtTime(detune + sweep, endTime);
        if (src.frequency !== undefined && vibrato !== undefined)
            this.#lfo(this.#audioCtx, src.frequency, ...vibrato);
        // if (!(this.#wav instanceof TableWave)) volume /= 4;
        let gainNode = new GainNode(this.#audioCtx);
        Synthesizer.envelope(gainNode.gain, startTime, endTime, volume, envelope);
        if (tremolo !== undefined) this.#lfo(this.#audioCtx, gainNode.gain, ...tremolo);
        if (this.#analyserNode) gainNode.connect(this.#analyserNode);
        src.connect(gainNode).connect(this.#audioCtx.destination);
        src.start(startTime);
        src.stop(endTime);
        let UUID = crypto.randomUUID();
        this.#tasks[UUID] = src;
        src.onended = () => {
            src.disconnect();
            // if (this.#wav instanceof NoiseWave) src.buffer = null;
            // if (src instanceof AudioBufferSourceNode) src.buffer = null;
            if (src.buffer) src.buffer = null;
            gainNode.disconnect();
            delete this.#tasks[UUID];
        };
        // return {eTime, freq: this.#wav.freq(pitch)};
        return { end: endTime };
    }
    discard() {
        Object.keys(this.#tasks).forEach(key => this.#tasks[key].stop());
    }
}

class Wave {
    #audioCtx;
    #strategy;
    #source;
    constructor(audioCtx, strategy, material, helper) {
        this.#audioCtx = audioCtx;
        this.#strategy = strategy;
        this.#source = strategy.generateSource(material, audioCtx, helper);
    }
    getSourceNode(noteNumber) {
        return this.#strategy.createSourceNode(this.#audioCtx, this.#source, noteNumber);
    }
}

function num2freq(noteNumber) {
    {
        if (typeof noteNumber !== 'number') {
            throw new TypeError(`Input must be a number: ${noteNumber}`);
        }
        if (noteNumber < 0 || noteNumber > 127) {
            throw new RangeError(`MIDI note number must be between 0 and 127: ${noteNumber}`);
        }
    }
    return 55 * 2 ** ((noteNumber - 33) / 12);
}

const presetWaveStrategy = {
    generateSource: type => type,
    createSourceNode: (audioCtx, source, noteNumber) => {
        return new OscillatorNode(audioCtx, {
            'type': source,
            'frequency': num2freq(noteNumber),
        });
    },
};

const noiseWaveStrategy = {
    generateSource: (periods = [1], audioCtx, randomNumberGenerator = Math.random) => {
        let sr = audioCtx.sampleRate,
            source = [];
        periods.forEach((period, noteNumber) => {
            source[noteNumber] = audioCtx.createBuffer(1, sr, sr);
            let data = source[noteNumber].getChannelData(0);
            let amplitude;
            for (let i = 0; i < sr; i++) {
                if (i % period == 0) amplitude = randomNumberGenerator(i) * 2 - 1;
                data[i] = amplitude;
            }
        });
        return source;
    },
    createSourceNode: (audioCtx, source, noteNumber) => {
        return new AudioBufferSourceNode(audioCtx, {
            buffer: source[noteNumber],
            loop: true,
        });
    },
};

const repeat = (list, symbol) => {
    let result = [];
    list.forEach((item) => {
        if (item.startsWith(symbol)) {
            let repeatNum = item.slice(1) || 1;
            let repeatBuf = result.slice(-repeatNum);
            result.push(...repeatBuf);
        } else {
            result.push(item);
        }
    });
    return result;
};

const createParser = (separator, repeater, nextParser) => (str) => {
    const separated = str.split(separator);
    const expanded = repeater ? repeat(separated, repeater) : separated;
    return nextParser ? expanded.map((nextStr) => nextParser(nextStr)) : expanded;
};

const duration = (value, bpm) => {
    let _value = value;
    if (/\.$/.test(value)) _value = value.slice(0, -1) / 1.5;
    if (/t$/.test(value)) _value = value.slice(0, -1) * 1.5;
    return (60 / bpm) * (4 / _value);
};

const buildEvent = (event, bpm, opt, defaultValue = '8') => {
    const dur = duration(event[1] ?? defaultValue, bpm);
    if (event[0] == '_') return ['_', { dur }];
    return [event[0] * 1, { dur, ...opt[event[2] ?? 0] }];
};

const parse = (kms) => {
    const parseEvent = createParser(',');
    const parseMeasure = createParser(' ', '+', parseEvent);
    const parseTrack = createParser('|', '%', parseMeasure);

    return kms.track.map((trackString, tid) =>
        parseTrack(trackString).map((measure) =>
            measure.map((event) => buildEvent(event, kms.bpm, kms.opt[tid], kms.value)),
        ),
    );
};

const play = (synthesizers, playbackData, seq, startSeq = 0, startTime = 0) => {
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

const stop = (synthesizers) => {
    synthesizers.forEach((synth) => synth.discard());
};

const getPlaytime = (kms) => {
    const beat = kms.time.split('/')[0];
    const numOfMeasures = kms.seq.length - (kms.loop ?? 0);
    return (60 / kms.bpm) * beat * numOfMeasures;
};

const loop = (synthesizers, playbackData, kms) => {
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

const kms = {
    bpm: 100,
    value: '16',
    time: '4/4',
    loop: 1,
    track: [
        '76 + _ 76 _ 72 76 _ 79 _,8. 67 _,8.|72 _,8 67 _,8 64 _ _ 69 _ 71 _ 70 69 _|67,8t,1 76,8t,1 79,8t,1 81 _ 77 79 _ 76 _ 72 74 71 _,8|_,8 79 78 77 75 _ 76 _ 68 69 72 _ 69 72 74|_,8 79 78 77 75 _ 76 _ 84 _ 84 84 _,8.|_,8 79 78 77 75 _ 76 _ 68 69 72 _ 69 72 74|_,8 75 _,8 74 _,8 72 _,8. _,4|72 + _ 72 _ 72 74 _ 76 72 _ 69 67 _,8.|72 + _ 72 _ 72 74 76 _,2|76 72 _ 67 _,8 68 _ 69 77 _ 77 69 _,8.|71,8t,1 81,8t,1 + 81,8t,1 79,8t,1 77,8t,1 76 72 _ 69 67 _,8.|71 77 _ 77 77,8t,1 76,8t,1 74,8t,1 72 _,8. _,4',
        '66 + _ 66 _ 66 + _ 71 _,8. _,4|64 _,8 60 _,8 55 _ _ 60 _ 62 _ 61 60 _|60,8t,1 67,8t,1 71,8t,1 72 _ 69 71 _ 69 _ 64 65 62 _,8|_,8 76 75 74 71 _ 72 _ 64 65 67 _ 60 64 65|_,8 76 75 74 71 _ 72 _ 77 _ 77 77 _,8.|_,8 76 75 74 71 _ 72 _ 64 65 67 _ 60 64 65|_,8 68 _,8 65 _,8 64 _,8. _,4|68 + _ 68 _ 68 70 _ 67 64 _ 64 60 _,8.|68 + _ 68 _ 68 70 67 _,2|72 69 _ 64 _,8 64 _ 65 72 _ 72 65 _,8.|67,8t,1 77,8t,1 + 77,8t,1 76,8t,1 74,8t,1 72 69 _ 65 64 _,8.|67 74 _ 74 74,8t,1 72,8t,1 71,8t,1 67 64 _ 64 60 _,8.',
        '50 + _ 50 _ 50 + _ 67 _,8. 55 _,8.|55 _,8 52 _,8 48 _ _ 53 _ 55 _ 54 53 _|52,8t 60,8t 64,8t 65 _ 62 64 _ 60 _ 57 59 55 _,8|48 _,8 55 _,8 60 _ 53 _,8 60 60 + 53 _|48 _,8 52 _,8 55 60 _ 79 _ 79 79 _ 55 _|48 _,8 55 _,8 60 _ 53 _,8 60 60 + 53 _|48 _ 56 _,8 58 _,8 60 _,8 55 55 _ 48 _|44 _,8 51 _,8 56 _ 55 _,8 48 _,8 43 _|%|48 _,8 54 55 _ 60 _ 53 _ 53 _ 60 + 53 _|50 _,8 53 55 _ 59 _ 55 _ 55 _ 60 + 55 _|55 _,8 55 55,8t 57,8t 59,8t 60 _ 55 _ 48 _,8.',
        '11 _ 11,16,1 11 _ 11,16,1 11 _ 11 _,8 11 _ 11,16,1 + +|2,16,3 _ 11,16,1 11,16,2 11 _ 11,16,1 11,16,2 2,16,3 _ 11,16,1 11,16,2 11 _ 11,16,1 11,16,2|%|%2|%2|11 _,8 11 _,8 11 _ 11 _,8 11 _ 11,16,1 + +|%|11,16,1 _,8 11,16,1 11 _ 11,16,1 _ 11,16,1 _,8 11,16,1 11 _ 11,16,1 _|%|%',
    ],
    seq: [
        0, 1, 2, 1, 2, 3, 4, 5, 6, 3, 4, 5, 6, 7, 8, 7, 0, 1, 2, 1, 2, 9, 10, 9, 11, 9, 10, 9, 11,
        7, 8, 7, 0, 9, 10, 9, 11,
    ],
    opt: [
        [
            { env: [0.01, 0.09, 0.75, 0.05], vol: 0.4 },
            { env: [0.01, 0, 1, 0.18], vol: 0.4 }, // triplet
        ],
        [
            { env: [0.01, 0.09, 0.75, 0.05], vol: 0.4 },
            { env: [0.01, 0, 1, 0.18], vol: 0.4 }, // triplet
        ],
        [{ env: [0.01, 0.09, 1, 0.05], vol: 0.4 }],
        [
            { env: [0, 0.09, 0, 0.05], vol: 0.4 },
            { env: [0.01, 0.01, 0, 0], vol: 0.4 }, // closed hi-hat
            { env: [0.01, 0.01, 0, 0], vol: 0.4, swg: 1 }, // closed hi-hat swing
            { env: [0, 0.02, 0, 0.13], vol: 0.4 }, // bass drum
        ],
    ],
};

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

const FC_PERIODS = [4068, 2034, 1016, 762, 508, 380, 254, 202, 160, 128, 96, 64, 32, 16, 8, 4];
let periods = [
    ...new Set(FC_PERIODS.map((fcp) => Math.round((audioCtx.sampleRate / 1789772.5) * fcp))),
].filter(Boolean);

const synthesizers = [
    new Synthesizer(audioCtx, [new Wave(audioCtx, presetWaveStrategy, 'square')]),
    new Synthesizer(audioCtx, [new Wave(audioCtx, presetWaveStrategy, 'square')]),
    new Synthesizer(audioCtx, [new Wave(audioCtx, presetWaveStrategy, 'triangle')]),
    new Synthesizer(audioCtx, [new Wave(audioCtx, noiseWaveStrategy, periods)]),
];

let playID = null;

document.querySelector('#play').onclick = () => {
    const playbackData = parse(kms);
    console.log(playbackData);
    playID = loop(synthesizers, playbackData, kms);
};

document.querySelector('#stop').onclick = () => {
    clearInterval(playID);
    stop(synthesizers);
};

// document.getElementById('resume').onclick = async () => {
//     if (audioCtx.state === 'suspended') {
//         await audioCtx.resume();
//         console.log('AudioContext resumed');
//     }
// };

const readChr = (Base64String) => {
    const TBL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let word;
    return [...Base64String].flatMap((chr) => [
        ((word = TBL.indexOf(chr)) >> 4) & 3,
        (word >> 2) & 3,
        word & 3,
    ]);
};

function lch(color) {
    let lightness = color[0];
    let hue = parseInt(color[1], 16);
    let h = 0,
        c = 0,
        l = 0;
    if (hue == 0) {
        l = lightness * 30 + 40;
    } else if (hue < 13) {
        h = (7 + hue) * 30;
        // c = 50;
        c = 55;
        // c = 65;
        // l = 35 + lightness * 26;
        l = 30 + lightness * 30;
    } else {
        l = (lightness - 2) * 30 + 30;
    }
    return 'lch(' + l + ' ' + c + '% ' + h + ')';
}

const CHR = (
    '/////////////1f/qf+qfw' + //   0: cloud v1
    'qn+qX6qnqqeqqaqpqqmqqQ' + //   1: cloud v2
    'qpmqpaqlqqmqqaqpqqmqqQ' + //   2: cloud v3
    '/9r/2v/a//b//f///////w' + //   3: cloud h1
    'qqqqqqqqqqpaqtqq9ar/VQ' + //   4: cloud h2
    'qqqqqqqqqqqqqmqqlqpVVQ' + //   5: cloud h3
    '//////////+qqqqqqqqqqg' + //   6: rainbow h half
    'AAAAAAAAAABVVVVVVVVVVQ' + //   7: rainbow h full
    '/6r/qv+q/6r/qv+q/6r/qg' + //   8: rainbow v half
    'AFUAVQBVAFUAVQBVAFUAVQ' + //   9: rainbow v full
    '//////////+qq6qqqqqqqg' + //  10: rainbow c 1-1
    '/////////////6//qv+qrw' + //  11: rainbow c 2-1
    'VVpVVVVVVVUAFQAAAAAAAA' + //  12: rainbow c 1-2
    'qqpqqlaqVWpVVlVVBVUAVQ' + //  13: rainbow c 2-2
    '//+//6//q/+q/6q/aq9aqw' + //  14: rainbow c 3-2
    'VWpVVlVVVVUAVQAFAAEAAA' + //  15: rainbow c 1-3
    'VWpVWhVWBVUBVQBVABUABQ' + //  16: rainbow c 2-3
    'VqpVqlWqVWoVahVaBVoFVg' + //  17: rainbow c 3-3
    '/////7//v/+v/6//q/+r/w' + //  18: rainbow c 4-3
    'qACqgKqgqqj6qP6q/6r/qg' + //  19: rainbow c 1-4
    'FVoFVgFWAVUAVQBVAFUAVQ' + //  20: rainbow c 2-4
    'AVYBVgFVAFUAVQBVAFUAVQ' + //  21: rainbow c 3-4
    'q/+q/6r/qv+q/6r/qv+q/w' + //  22: rainbow c 4-4
    '//////////////++/in+CQ' + //  23: unicorn  0 head
    '//////6/+L/gv4L/Yr9abw' + //  24: unicorn  1 head
    '+grmAOWAlYCVgpWClYCWAA' + //  25: unicorn  2 head
    'VW+lWwqvoC8oL6gLoAIAIg' + //  26: unicorn  3 head
    'VgCYAKAAAAAAAAAAAAAAAA' + //  27: unicorn  4 front
    'AAuqry//L/8v/y//L/+//w' + //  28: unicorn  5 front
    'AgKqAviC+YL+lv/r/////w' + //  29: unicorn  6 front
    '/+r/lf5V/lb+Vv5W/lapVg' + //  30: unicorn  7 back
    'vqpoAKAC4ADgAOAA4ADgAA' + //  31: unicorn  8 back
    '5Vv6r////////////////w' + //  32: unicorn  9 back
    '4AiAKoCLgluWr+v//////w' + //  33: unicorn 10 back
    'AgKqAv4K+Ar5a/6//////w' + //  34: unicorn  6 front
    '//7/6f+V/5b+Vv5W/la+Vg' + //  35: unicorn  7 back
    'qVblW/qv/////////////w' + //  36: unicorn  9 back
    'oAiICoILlgvqW/+v/////w' + //  37: unicorn 10 back
    ''
)
    .match(/.{22}/g)
    .map((chr) => readChr(chr));

const PLT = [
    '321030', //  0: cloud
    '262824', //  1: rainbow red yellow purple
    '2a2c22', //  2: rainbow green blue violet
    '26282a', //  3: rainbow red yellow green
    '282a2c', //  4: rainbow yellow green blue
    '282624', //  5: rainbow yellow red purple
    '2c2a22', //  6: rainbow blue green violet
    '2c2a28', //  7: rainbow blue green yellow
    '2a2826', //  8: rainbow green yellow red
    '382300', //  9: unicorn 1
    '202300', // 10: unicorn 2
].map((p) => p.match(/.{2}/g));

// [0:chrId, 1:pltId, 2:x, 3:y, 4:flipH, 5:flipV, 6:priority]
let SPR = [];

const sprUnicornR0 = [
    [23, 10, 16, 0], //  0 head
    [24, 9, 24, 0], //   1 head
    [25, 10, 16, 8], //  2 head
    [26, 10, 24, 8], //  3 head
    [27, 10, 16, 16], // 4 front
    [28, 10, 24, 16], // 5 front
    [29, 10, 16, 24], // 6 front
    [30, 10, 0, 16], //  7 back
    [31, 10, 8, 16], //  8 back
    [32, 10, 0, 24], //  9 back
    [33, 10, 8, 24], // 10 back
];

const sprUnicornR1 = [...sprUnicornR0];
sprUnicornR1[6] = [34, 10, 16, 24];
sprUnicornR1[7] = [35, 10, 0, 16];
sprUnicornR1[9] = [36, 10, 0, 24];
sprUnicornR1[10] = [37, 10, 8, 24];

const sprUnicornL0 = [
    [23, 10, 8, 0, 1], //    0 head
    [24, 9, 0, 0, 1], //     1 head
    [25, 10, 8, 8, 1], //    2 head
    [26, 10, 0, 8, 1], //    3 head
    [27, 10, 8, 16, 1], //   4 front
    [28, 10, 0, 16, 1], //   5 front
    [29, 10, 8, 24, 1], //   6 front
    [30, 10, 24, 16, 1], //  7 back
    [31, 10, 16, 16, 1], //  8 back
    [32, 10, 24, 24, 1], //  9 back
    [33, 10, 16, 24, 1], // 10 back
];

const sprUnicornL1 = [...sprUnicornL0];
sprUnicornL1[6] = [34, 10, 8, 24, 1];
sprUnicornL1[7] = [35, 10, 24, 16, 1];
sprUnicornL1[9] = [36, 10, 24, 24, 1];
sprUnicornL1[10] = [37, 10, 16, 24, 1];

// [0:chrId, 1:pltId, 2:x, 3:y, 4:flipH, 5:flipV, 6:priority]
// const PANEL = [...Array(16)].map(() => JSON.parse(JSON.stringify(PANEL_TEMPLATE)));
const PANEL = [...Array(16)].map(() => Array());

for (let i = 0; i < 8; i++) {
    PANEL[0].push([6, 1, 8 * i, 8]);
    PANEL[0].push([7, 1, 8 * i, 16]);
    PANEL[0].push([7, 2, 8 * i, 24]);
    PANEL[0].push([6, 2, 8 * i, 32, , 1]);
    PANEL[2].push([6, 2, 8 * i, 8]);
    PANEL[2].push([7, 2, 8 * i, 16, , 1]);
    PANEL[2].push([7, 1, 8 * i, 24, , 1]);
    PANEL[2].push([6, 1, 8 * i, 32, , 1]);
}
for (let i = 0; i < 6; i++) {
    PANEL[4].push([8, 1, 16, 8 * i]);
    PANEL[4].push([9, 1, 24, 8 * i]);
    PANEL[4].push([9, 2, 32, 8 * i]);
    PANEL[4].push([8, 2, 40, 8 * i, 1]);
    PANEL[6].push([8, 2, 16, 8 * i]);
    PANEL[6].push([9, 2, 24, 8 * i, 1]);
    PANEL[6].push([9, 1, 32, 8 * i, 1]);
    PANEL[6].push([8, 1, 40, 8 * i, 1]);
}

PANEL[1] = JSON.parse(JSON.stringify(PANEL[0]));
PANEL[3] = JSON.parse(JSON.stringify(PANEL[2]));
PANEL[5] = JSON.parse(JSON.stringify(PANEL[4]));
PANEL[7] = JSON.parse(JSON.stringify(PANEL[6]));

PANEL[8].push([6, 5, 56, 8]);
PANEL[8].push([7, 5, 56, 16, , 1]);
PANEL[8].push([7, 6, 56, 24, , 1]);
PANEL[8].push([6, 6, 56, 32, , 1]);
PANEL[8].push([6, 5, 48, 8]);
PANEL[8].push([7, 5, 48, 16, , 1]);
PANEL[8].push([7, 6, 48, 24, , 1]);
PANEL[8].push([6, 6, 48, 32, , 1]);
PANEL[8].push([10, 5, 40, 8, 1]);
PANEL[8].push([11, 5, 32, 8, 1]);
PANEL[8].push([12, 5, 40, 16, 1]);
PANEL[8].push([13, 5, 32, 16, 1]);
PANEL[8].push([14, 5, 24, 16, 1]);
PANEL[8].push([15, 7, 40, 24, 1]);
PANEL[8].push([16, 8, 32, 24, 1]);
PANEL[8].push([17, 5, 24, 24, 1]);
PANEL[8].push([18, 5, 16, 24, 1]);
PANEL[8].push([19, 6, 40, 32, 1]);
PANEL[8].push([20, 7, 32, 32, 1]);
PANEL[8].push([21, 5, 24, 32, 1]);
PANEL[8].push([22, 5, 16, 32, 1]);
PANEL[8].push([8, 1, 16, 40]);
PANEL[8].push([9, 1, 24, 40]);
PANEL[8].push([9, 2, 32, 40]);
PANEL[8].push([8, 2, 40, 40, 1]);

PANEL[12].push([8, 1, 16, 0]);
PANEL[12].push([9, 1, 24, 0]);
PANEL[12].push([9, 2, 32, 0]);
PANEL[12].push([8, 2, 40, 0, 1]);
PANEL[12].push([6, 2, 56, 8]);
PANEL[12].push([7, 2, 56, 16, , 1]);
PANEL[12].push([7, 1, 56, 24, , 1]);
PANEL[12].push([6, 1, 56, 32, , 1]);
PANEL[12].push([6, 2, 48, 8]);
PANEL[12].push([7, 2, 48, 16, , 1]);
PANEL[12].push([7, 1, 48, 24, , 1]);
PANEL[12].push([6, 1, 48, 32, , 1]);
PANEL[12].push([10, 5, 40, 32, 1, 1]);
PANEL[12].push([11, 5, 32, 32, 1, 1]);
PANEL[12].push([12, 5, 40, 24, 1, 1]);
PANEL[12].push([13, 5, 32, 24, 1, 1]);
PANEL[12].push([14, 5, 24, 24, 1, 1]);
PANEL[12].push([15, 7, 40, 16, 1, 1]);
PANEL[12].push([16, 8, 32, 16, 1, 1]);
PANEL[12].push([17, 5, 24, 16, 1, 1]);
PANEL[12].push([18, 5, 16, 16, 1, 1]);
PANEL[12].push([19, 6, 40, 8, 1, 1]);
PANEL[12].push([20, 7, 32, 8, 1, 1]);
PANEL[12].push([21, 5, 24, 8, 1, 1]);
PANEL[12].push([22, 5, 16, 8, 1, 1]);

PANEL[9].push([6, 5, 0, 8]);
PANEL[9].push([7, 5, 0, 16, , 1]);
PANEL[9].push([7, 6, 0, 24, , 1]);
PANEL[9].push([6, 6, 0, 32, , 1]);
PANEL[9].push([6, 5, 8, 8]);
PANEL[9].push([7, 5, 8, 16, , 1]);
PANEL[9].push([7, 6, 8, 24, , 1]);
PANEL[9].push([6, 6, 8, 32, , 1]);
PANEL[9].push([10, 5, 16, 8]);
PANEL[9].push([11, 5, 24, 8]);
PANEL[9].push([12, 5, 16, 16]);
PANEL[9].push([13, 5, 24, 16]);
PANEL[9].push([14, 5, 32, 16]);
PANEL[9].push([15, 7, 16, 24]);
PANEL[9].push([16, 8, 24, 24]);
PANEL[9].push([17, 5, 32, 24]);
PANEL[9].push([18, 5, 40, 24]);
PANEL[9].push([19, 6, 16, 32]);
PANEL[9].push([20, 7, 24, 32]);
PANEL[9].push([21, 5, 32, 32]);
PANEL[9].push([22, 5, 40, 32]);
PANEL[9].push([8, 2, 16, 40]);
PANEL[9].push([9, 2, 24, 40, 1]);
PANEL[9].push([9, 1, 32, 40, 1]);
PANEL[9].push([8, 1, 40, 40, 1]);

PANEL[13].push([6, 2, 0, 8]);
PANEL[13].push([7, 2, 0, 16, , 1]);
PANEL[13].push([7, 1, 0, 24, , 1]);
PANEL[13].push([6, 1, 0, 32, , 1]);
PANEL[13].push([6, 2, 8, 8]);
PANEL[13].push([7, 2, 8, 16, , 1]);
PANEL[13].push([7, 1, 8, 24, , 1]);
PANEL[13].push([6, 1, 8, 32, , 1]);
PANEL[13].push([10, 5, 16, 32, , 1]);
PANEL[13].push([11, 5, 24, 32, , 1]);
PANEL[13].push([12, 5, 16, 24, , 1]);
PANEL[13].push([13, 5, 24, 24, , 1]);
PANEL[13].push([14, 5, 32, 24, , 1]);
PANEL[13].push([15, 7, 16, 16, , 1]);
PANEL[13].push([16, 8, 24, 16, , 1]);
PANEL[13].push([17, 5, 32, 16, , 1]);
PANEL[13].push([18, 5, 40, 16, , 1]);
PANEL[13].push([19, 6, 16, 8, , 1]);
PANEL[13].push([20, 7, 24, 8, , 1]);
PANEL[13].push([21, 5, 32, 8, , 1]);
PANEL[13].push([22, 5, 40, 8, , 1]);
PANEL[13].push([8, 2, 16, 0]);
PANEL[13].push([9, 2, 24, 0, 1]);
PANEL[13].push([9, 1, 32, 0, 1]);
PANEL[13].push([8, 1, 40, 0, 1]);

PANEL[10].push([6, 2, 56, 8]);
PANEL[10].push([7, 2, 56, 16, , 1]);
PANEL[10].push([7, 1, 56, 24, , 1]);
PANEL[10].push([6, 1, 56, 32, , 1]);
PANEL[10].push([6, 2, 48, 8]);
PANEL[10].push([7, 2, 48, 16, , 1]);
PANEL[10].push([7, 1, 48, 24, , 1]);
PANEL[10].push([6, 1, 48, 32, , 1]);
PANEL[10].push([10, 2, 40, 8, 1]);
PANEL[10].push([11, 2, 32, 8, 1]);
PANEL[10].push([12, 2, 40, 16, 1]);
PANEL[10].push([13, 2, 32, 16, 1]);
PANEL[10].push([14, 2, 24, 16, 1]);
PANEL[10].push([15, 3, 40, 24, 1]);
PANEL[10].push([16, 4, 32, 24, 1]);
PANEL[10].push([17, 2, 24, 24, 1]);
PANEL[10].push([18, 2, 16, 24, 1]);
PANEL[10].push([19, 1, 40, 32, 1]);
PANEL[10].push([20, 3, 32, 32, 1]);
PANEL[10].push([21, 2, 24, 32, 1]);
PANEL[10].push([22, 2, 16, 32, 1]);
PANEL[10].push([8, 2, 16, 40]);
PANEL[10].push([9, 2, 24, 40, 1]);
PANEL[10].push([9, 1, 32, 40, 1]);
PANEL[10].push([8, 1, 40, 40, 1]);

PANEL[14].push([6, 5, 56, 8]);
PANEL[14].push([7, 5, 56, 16, , 1]);
PANEL[14].push([7, 6, 56, 24, , 1]);
PANEL[14].push([6, 6, 56, 32, , 1]);
PANEL[14].push([6, 5, 48, 8]);
PANEL[14].push([7, 5, 48, 16, , 1]);
PANEL[14].push([7, 6, 48, 24, , 1]);
PANEL[14].push([6, 6, 48, 32, , 1]);
PANEL[14].push([10, 2, 40, 32, 1, 1]);
PANEL[14].push([11, 2, 32, 32, 1, 1]);
PANEL[14].push([12, 2, 40, 24, 1, 1]);
PANEL[14].push([13, 2, 32, 24, 1, 1]);
PANEL[14].push([14, 2, 24, 24, 1, 1]);
PANEL[14].push([15, 3, 40, 16, 1, 1]);
PANEL[14].push([16, 4, 32, 16, 1, 1]);
PANEL[14].push([17, 2, 24, 16, 1, 1]);
PANEL[14].push([18, 2, 16, 16, 1, 1]);
PANEL[14].push([19, 1, 40, 8, 1, 1]);
PANEL[14].push([20, 3, 32, 8, 1, 1]);
PANEL[14].push([21, 2, 24, 8, 1, 1]);
PANEL[14].push([22, 2, 16, 8, 1, 1]);
PANEL[14].push([8, 2, 16, 0]);
PANEL[14].push([9, 2, 24, 0, 1]);
PANEL[14].push([9, 1, 32, 0, 1]);
PANEL[14].push([8, 1, 40, 0, 1]);

PANEL[11].push([6, 2, 0, 8]);
PANEL[11].push([7, 2, 0, 16, , 1]);
PANEL[11].push([7, 1, 0, 24, , 1]);
PANEL[11].push([6, 1, 0, 32, , 1]);
PANEL[11].push([6, 2, 8, 8]);
PANEL[11].push([7, 2, 8, 16, , 1]);
PANEL[11].push([7, 1, 8, 24, , 1]);
PANEL[11].push([6, 1, 8, 32, , 1]);
PANEL[11].push([10, 2, 16, 8]);
PANEL[11].push([11, 2, 24, 8]);
PANEL[11].push([12, 2, 16, 16]);
PANEL[11].push([13, 2, 24, 16]);
PANEL[11].push([14, 2, 32, 16]);
PANEL[11].push([15, 3, 16, 24]);
PANEL[11].push([16, 4, 24, 24]);
PANEL[11].push([17, 2, 32, 24]);
PANEL[11].push([18, 2, 40, 24]);
PANEL[11].push([19, 1, 16, 32]);
PANEL[11].push([20, 3, 24, 32]);
PANEL[11].push([21, 2, 32, 32]);
PANEL[11].push([22, 2, 40, 32]);
PANEL[11].push([8, 1, 16, 40]);
PANEL[11].push([9, 1, 24, 40]);
PANEL[11].push([9, 2, 32, 40]);
PANEL[11].push([8, 2, 40, 40, 1]);

PANEL[15].push([6, 5, 0, 8]);
PANEL[15].push([7, 5, 0, 16, , 1]);
PANEL[15].push([7, 6, 0, 24, , 1]);
PANEL[15].push([6, 6, 0, 32, , 1]);
PANEL[15].push([6, 5, 8, 8]);
PANEL[15].push([7, 5, 8, 16, , 1]);
PANEL[15].push([7, 6, 8, 24, , 1]);
PANEL[15].push([6, 6, 8, 32, , 1]);
PANEL[15].push([10, 2, 16, 32, , 1]);
PANEL[15].push([11, 2, 24, 32, , 1]);
PANEL[15].push([12, 2, 16, 24, , 1]);
PANEL[15].push([13, 2, 24, 24, , 1]);
PANEL[15].push([14, 2, 32, 24, , 1]);
PANEL[15].push([15, 3, 16, 16, , 1]);
PANEL[15].push([16, 4, 24, 16, , 1]);
PANEL[15].push([17, 2, 32, 16, , 1]);
PANEL[15].push([18, 2, 40, 16, , 1]);
PANEL[15].push([19, 1, 16, 8, , 1]);
PANEL[15].push([20, 3, 24, 8, , 1]);
PANEL[15].push([21, 2, 32, 8, , 1]);
PANEL[15].push([22, 2, 40, 8, , 1]);
PANEL[15].push([8, 1, 16, 0]);
PANEL[15].push([9, 1, 24, 0]);
PANEL[15].push([9, 2, 32, 0]);
PANEL[15].push([8, 2, 40, 0, 1]);

// [0: top, 1: bottom, 2: left, 3: right]
const PANEL_TERMINAL = [
    [, , 1, 1], //  0
    [, , 1, 1], //  1
    [, , 0, 0], //  2
    [, , 0, 0], //  3
    [1, 1], //      4
    [1, 1], //      5
    [0, 0], //      6
    [0, 0], //      7
    [, 1, , 1], //  8
    [, 0, 1], //    9
    [, 0, , 0], // 10
    [, 1, 0], //   11
    [1, , , 0], // 12
    [0, , 0], //   13
    [0, , , 1], // 14
    [1, , 1], //   15
];

let PANEL_MAP = [...Array(16).keys()];
// console.log(PANEL_MAP);

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

PANEL_MAP = shuffle(PANEL_MAP);
// console.log(PANEL_MAP);

// PANEL_MAP[15] じゃなく、角のパネル以外のどれかランダムにしたい
//ゴールのパネルを作る？
let removalMapId = 15;
const REMOVAL_PID = PANEL_MAP[removalMapId];
PANEL[REMOVAL_PID] = [];
PANEL_TERMINAL[REMOVAL_PID] = [];

const setBg = () =>
    PANEL_MAP.flatMap((pid, order) => {
        const column = order % 4,
            row = order >> 2;
        const chrSet = [...PANEL[pid]];
        // //cloud t
        if (
            row == 0 ||
            PANEL_TERMINAL[pid][0] === undefined ||
            PANEL_TERMINAL[pid][0] != PANEL_TERMINAL[PANEL_MAP[order - 4]][1]
        ) {
            [
                [3, 0, 8, 0], //          0: cloud t
                [4, 0, 16, 0], //         1:
                [5, 0, 24, 0], //         2:
                [5, 0, 32, 0, 1], //      3:
                [4, 0, 40, 0, 1], //      4:
                [3, 0, 48, 0, 1], //      5:
            ].forEach((c) => chrSet.push(c));
        }
        // //cloud b
        if (
            row == 3 ||
            PANEL_TERMINAL[pid][1] === undefined ||
            PANEL_TERMINAL[pid][1] != PANEL_TERMINAL[PANEL_MAP[order + 4]][0]
        ) {
            [
                [3, 0, 8, 40, 0, 1], //   6: cloud b
                [4, 0, 16, 40, 0, 1], //  7:
                [5, 0, 24, 40, 0, 1], //  8:
                [5, 0, 32, 40, 1, 1], //  9:
                [4, 0, 40, 40, 1, 1], // 10:
                [3, 0, 48, 40, 1, 1], // 11:
            ].forEach((c) => chrSet.push(c));
        }
        // //cloud l
        if (
            column == 0 ||
            PANEL_TERMINAL[pid][2] === undefined ||
            PANEL_TERMINAL[pid][2] != PANEL_TERMINAL[PANEL_MAP[order - 1]][3]
        ) {
            [
                [0, 0, 0, 0], //         12: cloud l
                [1, 0, 0, 8], //         13:
                [2, 0, 0, 16], //        14:
                [2, 0, 0, 24, 0, 1], //  15:
                [1, 0, 0, 32, 0, 1], //  16:
                [0, 0, 0, 40, 0, 1], //  17:
            ].forEach((c) => chrSet.push(c));
        }
        // //cloud r
        if (
            column == 3 ||
            PANEL_TERMINAL[pid][3] === undefined ||
            PANEL_TERMINAL[pid][3] != PANEL_TERMINAL[PANEL_MAP[order + 1]][2]
        ) {
            [
                [0, 0, 56, 0, 1], //     18: cloud r
                [1, 0, 56, 8, 1], //     19:
                [2, 0, 56, 16, 1], //    20:
                [2, 0, 56, 24, 1, 1], // 21:
                [1, 0, 56, 32, 1, 1], // 22:
                [0, 0, 56, 40, 1, 1], // 23:
            ].forEach((c) => chrSet.push(c));
        }
        return chrSet.map((chr) =>
            chr.map((prm, id) =>
                id == 2 ? prm + (order % 4) * 64 : id == 3 ? prm + (order >> 2) * 48 : prm,
            ),
        );
    });
let BG0 = setBg();
// console.log(BG0);

const SCALE = 3;
// const SCALE = 2;
let bgColor = '32';
const CANVAS = document.querySelector('#s canvas');
const canvasRenderingCtx = CANVAS.getContext('2d');
const CANVAS_WIDTH = 256 * SCALE; //256, 160
const CANVAS_HEIGHT = 192 * SCALE; //240, 192, 144, 120
CANVAS.width = CANVAS_WIDTH;
CANVAS.height = CANVAS_HEIGHT;
canvasRenderingCtx.imageSmoothingEnabled = false;
canvasRenderingCtx.scale(SCALE, SCALE);
const oscBg = new OffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
const oscBgCtx = oscBg.getContext('2d');
const oscSp = new OffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
const oscSpCtx = oscSp.getContext('2d');

const drawChr = (chr, oscCtx) => {
    for (let i = 0; i < 64; i++) {
        const flipH = chr[4] ? 7 : 0,
            flipV = chr[5] ? 56 : 0,
            color = CHR[chr[0]][i ^ flipH ^ flipV];
        if (color < 3) {
            oscCtx.fillStyle = lch(PLT[chr[1]][color]);
            oscCtx.fillRect(chr[2] + (i % 8), chr[3] + (i >> 3), 1, 1);
        }
    }
};

const drawBG = () => {
    oscBgCtx.fillStyle = lch(bgColor);
    oscBgCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    BG0.forEach((chr) => drawChr(chr, oscBgCtx));
};
drawBG();

const unicorn = { panel: 0, x: 16, y: 16, direction: 'N', lr: 'R' };

let lastTime = 0;

const main = (timestamp) => {
    const counter = Math.floor(timestamp / 250);
    // document.querySelector('#debug').innerHTML = counter + ': ' + (counter % 2);
    document.querySelector('#debug').innerHTML =
        'panel: ' +
        unicorn.panel +
        ', pid: ' +
        PANEL_MAP[unicorn.panel] +
        ', ' +
        PANEL_TERMINAL[PANEL_MAP[unicorn.panel]][1];

    if (timestamp - lastTime > 32) {
        const terminal = PANEL_TERMINAL[PANEL_MAP[unicorn.panel]];
        if (unicorn.direction == 'N') {
            if (unicorn.y > 16) {
                unicorn.y--;
                // unicorn.x -= 2;
                lastTime = timestamp;
            } else if (unicorn.y > 0 && terminal[0] !== undefined) {
                unicorn.y--;
                // unicorn.x -= 2;
                lastTime = timestamp;
            } else {
                unicorn.direction = unicorn.y == 0 ? 'S' : terminal[2] !== undefined ? 'W' : 'E';
            }
        }
        if (unicorn.direction == 'S') {
            // if (unicorn.y < 32) {
            if (unicorn.y < 16) {
                unicorn.y++;
                // unicorn.x += 2;
                lastTime = timestamp;
            } else if (unicorn.y < 32 && terminal[1] !== undefined) {
                unicorn.y++;
                // unicorn.x += 2;
                lastTime = timestamp;
            } else {
                unicorn.direction = unicorn.y == 32 ? 'N' : terminal[2] !== undefined ? 'W' : 'E';
            }
        }
        if (unicorn.direction == 'W') {
            unicorn.lr = 'L';
            if (unicorn.x > 16) {
                unicorn.x--;
                // unicorn.x -= 2;
                lastTime = timestamp;
            } else if (unicorn.x > 0 && terminal[2] !== undefined) {
                unicorn.x--;
                // unicorn.x -= 2;
                lastTime = timestamp;
            } else {
                unicorn.direction = unicorn.x == 0 ? 'E' : terminal[0] !== undefined ? 'N' : 'S';
            }
        }
        if (unicorn.direction == 'E') {
            unicorn.lr = 'R';
            if (unicorn.x < 16) {
                unicorn.x++;
                // unicorn.x += 2;
                lastTime = timestamp;
            } else if (unicorn.x < 32 && terminal[3] !== undefined) {
                unicorn.x++;
                // unicorn.x += 2;
                lastTime = timestamp;
            } else {
                unicorn.direction = unicorn.x == 32 ? 'W' : terminal[0] !== undefined ? 'N' : 'S';
            }
        }
    }

    oscSpCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    SPR =
        unicorn.lr == 'R'
            ? counter % 2 == 0
                ? [...sprUnicornR0]
                : [...sprUnicornR1]
            : counter % 2 == 0
              ? [...sprUnicornL0]
              : [...sprUnicornL1];
    const xOffset = unicorn.x + (unicorn.panel % 4) * 64;
    const yOffset = unicorn.y + (unicorn.panel >> 2) * 48 - 21;
    // document.querySelector('#debug').innerHTML = 'xOffset: ' + xOffset + ', yOffset: ' + yOffset;
    //0:chrId, 1:pltId, 2:x, 3:y, 4:flipH, 5:flipV, 6:priority
    SPR.map((s) => [s[0], s[1], s[2] + xOffset, s[3] + yOffset, s[4], s[5], s[6]])
        .filter((chr) => chr[6] === 0 || chr[6] === undefined)
        .forEach((chr) => drawChr(chr, oscSpCtx));

    canvasRenderingCtx.drawImage(oscBg, 0, 0);
    canvasRenderingCtx.drawImage(oscSp, 0, 0);

    requestAnimationFrame(main);
};
main();

CANVAS.onclick = (e) => {
    const rect = e.target.getBoundingClientRect();
    const clickX = e.clientX - Math.floor(rect.left);
    const clickY = e.clientY - Math.floor(rect.top);
    const blockW = e.target.width / 4;
    const blockH = e.target.height / 4;
    const clickCol = Math.floor(clickX / blockW);
    const clickRow = Math.floor(clickY / blockH);
    const clickMapId = clickRow * 4 + clickCol;
    const removalCol = removalMapId % 4;
    const removalRow = removalMapId >> 2;

    const unicornCol = unicorn.panel % 4;
    const unicornRow = unicorn.panel >> 2;

    // vertical slide
    if (clickCol == removalCol) {
        // north
        if (clickRow > removalRow) {
            for (let i = removalRow + 1; i <= clickRow; i++) {
                PANEL_MAP[(i - 1) * 4 + clickCol] = PANEL_MAP[i * 4 + clickCol];
            }
            removalMapId = clickMapId;
            if (unicornCol == clickCol && unicornRow > removalRow && unicornRow <= clickRow)
                unicorn.panel = unicorn.panel - 4;
        }
        // south
        if (clickRow < removalRow) {
            for (let i = removalRow - 1; i >= clickRow; i--) {
                PANEL_MAP[(i + 1) * 4 + clickCol] = PANEL_MAP[i * 4 + clickCol];
            }
            removalMapId = clickMapId;
            if (unicornCol == clickCol && unicornRow < removalRow && unicornRow >= clickRow)
                unicorn.panel = unicorn.panel + 4;
        }
    }
    // horizontal slide
    if (clickRow == removalRow) {
        // west
        if (clickCol > removalCol) {
            for (let i = removalCol + 1; i <= clickCol; i++) {
                PANEL_MAP[clickRow * 4 + i - 1] = PANEL_MAP[clickRow * 4 + i];
            }
            removalMapId = clickMapId;
            if (unicornRow == clickRow && unicornCol > removalCol && unicornCol <= clickCol)
                unicorn.panel = unicorn.panel - 1;
        }
        // east
        if (clickCol < removalCol) {
            for (let i = removalCol - 1; i >= clickCol; i--) {
                PANEL_MAP[clickRow * 4 + i + 1] = PANEL_MAP[clickRow * 4 + i];
            }
            removalMapId = clickMapId;
            if (unicornRow == clickRow && unicornCol < removalCol && unicornCol >= clickCol)
                unicorn.panel = unicorn.panel + 1;
        }
    }
    PANEL_MAP[removalMapId] = REMOVAL_PID;
    // console.log('clickMapId: ' + clickMapId, 'removalMapId: ' + removalMapId);
    BG0 = setBg();

    drawBG();
};

function adjustContainer() {
    // let scale;
    // if (window.innerWidth < window.innerHeight) {
    //     scale = window.innerWidth / document.querySelector('#scr').width;
    // } else {
    //     scale = window.innerHeight / document.querySelector('#scr').height;
    //     document.querySelector('#ctrl').style.display = 'none';
    // }
    // document.querySelector('#scr').style.transform = 'scale(' + scale + ')';
    // document.querySelector('#scrDiv').style.width = document.querySelector('#scr').width * scale + 'px'
    document.querySelector('#s').style.width = document.querySelector('canvas').width + 'px';
    // alert(document.querySelector('#scrDiv').style.width);
}

window.onload = function () {
    adjustContainer();
};
//# sourceMappingURL=bundle.js.map
