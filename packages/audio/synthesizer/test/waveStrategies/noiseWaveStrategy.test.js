import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noiseWaveStrategy } from '../../src/waveStrategies/noiseWaveStrategy.mjs';

global.__DEV__ = true;

let mockAudioCtx = {
    sampleRate: 44100,
    // eslint-disable-next-line no-unused-vars
    createBuffer: (numOfChannels, length, sampleRate) => {
        return {
            // eslint-disable-next-line no-unused-vars
            getChannelData: channel => new Float32Array(length),
        };
    },
};

class MockAudioBufferSourceNode {
    constructor(audioCtx, options) {
        this.buffer = options.buffer;
        this.loop = options.loop;
    }
}

global.AudioBufferSourceNode = MockAudioBufferSourceNode;

test('noiseWaveStrategy generates noise buffer', () => {
    const periods = [440, 10, 1];
    const source = noiseWaveStrategy.generateSource(periods, mockAudioCtx);

    assert.strictEqual(source.length, periods.length);
    source.forEach(buffer => {
        assert.ok(buffer.getChannelData(0) instanceof Float32Array);
        assert.strictEqual(buffer.getChannelData(0).length, mockAudioCtx.sampleRate);
    });
});

test('noiseWaveStrategy creates source node with correct buffer', () => {
    const periods = [1];
    const source = noiseWaveStrategy.generateSource(periods, mockAudioCtx);
    const pitch = 0;
    const sourceNode = noiseWaveStrategy.createSourceNode(mockAudioCtx, source, pitch);

    assert.ok(sourceNode instanceof MockAudioBufferSourceNode);
    assert.strictEqual(sourceNode.buffer, source[pitch]);
    assert.strictEqual(sourceNode.loop, true);
});
