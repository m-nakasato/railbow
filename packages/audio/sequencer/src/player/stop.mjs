export const stop = (synthesizers) => {
    synthesizers.forEach((synth) => synth.discard());
};
