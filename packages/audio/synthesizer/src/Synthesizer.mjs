import { validatePlayArgs } from './validators/play.mjs';

export class Synthesizer {
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
        if (__DEV__) validatePlayArgs(noteNumber, options, this.#waves);

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
