export function lfo(audioCtx, target, depth, rate = 5, wave = 'sine') {
    let lfo = new OscillatorNode(audioCtx, { 'frequency': rate, 'type': wave });
    lfo.start();
    let gainNode = new GainNode(audioCtx, { 'gain': depth });
    lfo.connect(gainNode).connect(target);
}
