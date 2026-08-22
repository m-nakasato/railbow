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
        // h = hue * 30 + 200;
        // h = hue * 28 + 225;
        // h = hue * 28 + 230;
        h = hue * 28 + 235; //
        c = 55;
        // c = 65;
        //l = lightness * 25 + 25;
        l = lightness * 26 + 35;
    } else {
        l = (lightness - 2) * 30 + 30;
    }
    return 'lch(' + l + ' ' + c + '% ' + h + ')';
}

const CHR = (
    'AAEAFQFVFVVVVlVqVqpqqg' + //   0: straight
    'V/9T/0P/VV+A/6APAAMIAw' + //   1:
    '6ADqAP6A/4D/mv6a+prqmg' + //   2:
    'qq8qrwA/C/+m/6a/pq+mqw' + //   3:
    '6lqqWqpVqkUAVQBVwFXBVQ' + //   4:
    '9VXVV9Vf1V/6r/qvqq+qrw' + //   5:
    'VVZVVlVWqqpWVVZVVlWqqg' + //   6:
    'QAAVVRVVFVUVVRVVFVUVVQ' + //   7:
    'JAFhVmFWYVZiVmapYAJhVg' + //   8:
    'FVUVVaVVClUQqhUCFVZqqQ' + //   9:
    'YVZhVoVWhVYVVhVWFVoqqQ' + //  10:
    ''
)
    .match(/.{22}/g)
    .map((chr) => readChr(chr));

const PLT = [
    '271618', // 0: mario
    '273019', // 1:
    '27170d', // 2:
].map((p) => p.match(/.{2}/g));

// [0:chrId, 1:pltId, 2:x, 3:y, 4:flipH, 5:flipV, 6:priority]
// const SPR = [
//     [0, 0, 120, 128, 0, 0, 0],
//     [1, 0, 128, 128, 0, 0, 0],
//     [2, 0, 120, 136, 0, 0, 0],
//     [3, 0, 128, 136, 0, 0, 0],
//     [4, 0, 120, 144, 0, 0, 0],
//     [4, 0, 128, 144, 1, 0, 0],
//     [5, 0, 120, 152, 0, 0, 0],
//     [5, 0, 128, 152, 1, 0, 0],
// ];

// [0:[ltChrId, rtChrId, lbChrId, rbChrId], 1:pltId]
const BG_MAP_0 = [...Array(16 * 12)];
// const BG_MAP_1 = [...Array(16 * 12)];

for (let i = 0; i < 16; i++) {
    BG_MAP_0[i + 0 * 10] = [[0, 0, 0, 0], 0];
    // BG_MAP_1[i + 16 * 10] = [[7, 8, 9, 10], 2];
}

// const setBgMap = (bgMap, ptnArr, plt, x, y) => {
//     // bgMap[y * 16 + x] = [ptnArr, plt];
//     for (let i = 0; i < 16; i++) {
//         bgMap[y * i + x] = [ptnArr, plt];
//     }
// };

// const setBgMapMulch = (bgMap, ptnArr, plt, coordString) => {
//     coordString
//         .match(/.{2}/g)
//         .map((coordXY) => coordXY.match(/.{1}/g).map((c) => parseInt(c, 16)))
//         .forEach((coord) => setBgMap(bgMap, ptnArr, plt, coord[0], coord[1]));
// };
// const n03 = '0010200121022203230414244050515253548090A0A192838494A4C0D0E0E1C2D2E2E3C4D4E4';
// const n47 = '20112102220313232440506041425262634454648090A0818292A283A38494A4C0D0E0C1E1E2D3D4';
// setBgMapMulch(BG_MAP_0, [6, 6, 6, 6], 2, n03);
// setBgMapMulch(BG_MAP_1, [6, 6, 6, 6], 2, n47);

const buildBG = (BG_MAP) =>
    BG_MAP.flatMap((bg, bgIdx) =>
        bg === undefined
            ? undefined
            : bg[0].map((chrId, chrIdx) => [
                  chrId,
                  bg[1],
                  (bgIdx % 16) * 16 + (chrIdx % 2) * 8,
                  (bgIdx >> 4) * 16 + (chrIdx >> 1) * 8,
              ]),
    ).filter((bg) => bg !== undefined);

const BG0 = buildBG(BG_MAP_0);
// const BG1 = buildBG(BG_MAP_1);

const SCALE = 3;
// const SCALE = 2;
let bgColor = '12';
const CANVAS = document.querySelector('#s canvas');
const canvasRenderingCtx = CANVAS.getContext('2d');
const CANVAS_WIDTH = 256 * SCALE; //256, 160
const CANVAS_HEIGHT = 192 * SCALE; //240, 192, 144, 120
CANVAS.width = CANVAS_WIDTH;
CANVAS.height = CANVAS_HEIGHT;
canvasRenderingCtx.scale(SCALE, SCALE);
const offScreenCanvas = new OffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
const offScreenCanvasRenderingCtx = offScreenCanvas.getContext('2d');

const drawChr = (chr) => {
    for (let i = 0; i < 64; i++) {
        const flipH = chr[4] ? 7 : 0,
            flipV = chr[5] ? 56 : 0,
            color = CHR[chr[0]][i ^ flipH ^ flipV];
        if (color < 3) {
            offScreenCanvasRenderingCtx.fillStyle = lch(PLT[chr[1]][color]);
            offScreenCanvasRenderingCtx.fillRect(chr[2] + (i % 8), chr[3] + (i >> 3), 1, 1);
        }
    }
};

let bgX = 0;
let bgSwitch = 0;
let bgXVelocity = 0;

const draw = () => {
    offScreenCanvasRenderingCtx.fillStyle = lch(bgColor);
    offScreenCanvasRenderingCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    bgX += bgXVelocity;
    if (bgX > 256) {
        bgX = 0;
        bgSwitch = 1 - bgSwitch;
    }
    document.getElementById('debug').innerText = `bgX: ${bgX}, bgXVelocity: ${bgXVelocity}`;

    // SPR.filter((chr) => chr[6] === 1).forEach(drawChr);

    BG0.map((chr) => [chr[0], chr[1], chr[2] - bgX + 256 * (0 + bgSwitch), chr[3]]).forEach(
        drawChr,
    );
    // BG1.map((chr) => [chr[0], chr[1], chr[2] - bgX + 256 * (1 - bgSwitch), chr[3]]).forEach(
    //     drawChr,
    // );

    // SPR.filter((chr) => chr[6] === 0).forEach(drawChr);

    canvasRenderingCtx.drawImage(offScreenCanvas, 0, 0);

    requestAnimationFrame(draw);
};

draw();

const walkStart = () => {
    bgXVelocity = 2;
};

const walkStop = () => {
    bgXVelocity = 0;
};

document.onkeydown = (e) => {
    // if (e.repeat || pc.energyVal < 1) return;
    if (e.repeat) return;
    // console.log(e.key)
    let k = e.key;
    // if (k == ' ') {
    //     let target = pcAttack();
    //     if (target) console.log(target);
    // } //攻撃中は移動したくない
    // if (k == 'ArrowLeft' || k == 'a') walk('x', -1);
    // if (k == 'ArrowRight' || k == 'd') walk('x', 1);
    // if (k == 'ArrowDown' || k == 's') walk('y', 1);
    // if (k == 'ArrowUp' || k == 'w') walk('y', -1);
    if (k == 'ArrowRight' || k == 'd') walkStart();
};
document.onkeyup = (e) => {
    //     if (pc.energyVal < 1) return;
    //     let k = e.key;
    //     if (k == 'ArrowLeft' || k == 'a') stop('x');
    //     if (k == 'ArrowRight' || k == 'd') stop('x');
    //     if (k == 'ArrowDown' || k == 's') stop('y');
    //     if (k == 'ArrowUp' || k == 'w') stop('y');
    if (e.key == 'ArrowRight' || e.key == 'd') walkStop();
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
