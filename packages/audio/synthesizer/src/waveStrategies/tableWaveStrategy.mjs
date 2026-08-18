import { num2freq } from '../utils/num2freq.mjs';
import { dft } from '../utils/dft.mjs';

export const tableWaveStrategy = {
    generateSource: (table, audioCtx) => {
        let d = [];
        for (let i = 0; i < table.length; i++) {
            d[i] = parseInt(table.charAt(i), 16);
        }
        return new PeriodicWave(audioCtx, dft(d, 512));
    },
    createSourceNode: (audioCtx, source, noteNumber) => {
        return new OscillatorNode(audioCtx, {
            'periodicWave': source,
            'frequency': num2freq(noteNumber),
        });
    },
};
