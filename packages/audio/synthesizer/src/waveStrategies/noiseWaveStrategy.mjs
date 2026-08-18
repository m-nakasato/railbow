export const noiseWaveStrategy = {
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
