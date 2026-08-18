import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presetWaveStrategy } from '../../src/waveStrategies/presetWaveStrategy.mjs';

global.__DEV__ = true;

// Mock: OscillatorNode for testing (Web Audio API is not available in Node.js)
class MockOscillatorNode {
    constructor(audioCtx, options) {
        this.audioCtx = audioCtx;
        this.frequency = options.frequency;
        this.type = options.type;
    }
}

global.OscillatorNode = MockOscillatorNode;

test('presetWaveStrategy generates correct source type', () => {
    const type = 'sawtooth';
    const source = presetWaveStrategy.generateSource(type);
    assert.strictEqual(source, type);
});

test('presetWaveStrategy creates OscillatorNode with correct frequency', () => {
    const audioCtx = {};
    const sourceType = 'square';
    const pitch = 81;
    const oscillatorNode = presetWaveStrategy.createSourceNode(audioCtx, sourceType, pitch);

    assert.ok(oscillatorNode instanceof MockOscillatorNode);
    assert.strictEqual(oscillatorNode.frequency, 880);
    assert.strictEqual(oscillatorNode.type, sourceType);
});
