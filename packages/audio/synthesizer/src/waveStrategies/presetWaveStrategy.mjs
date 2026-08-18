import { num2freq } from '../utils/num2freq.mjs';

export const presetWaveStrategy = {
    generateSource: type => type,
    createSourceNode: (audioCtx, source, noteNumber) => {
        return new OscillatorNode(audioCtx, {
            'type': source,
            'frequency': num2freq(noteNumber),
        });
    },
};
