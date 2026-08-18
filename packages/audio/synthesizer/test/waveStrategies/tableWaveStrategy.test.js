import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tableWaveStrategy } from '../../src/waveStrategies/tableWaveStrategy.mjs';

global.__DEV__ = true;

// Mock: PeriodicWave for testing (Web Audio API is not available in Node.js)
class MockPeriodicWave {
    constructor(audioCtx, options) {
        this.audioCtx = audioCtx;
        this.options = options;
    }
}

// Mock: OscillatorNode for testing (Web Audio API is not available in Node.js)
class MockOscillatorNode {
    constructor(audioCtx, options) {
        this.audioCtx = audioCtx;
        this.frequency = options.frequency;
        this.type = 'custom';
    }
}

global.PeriodicWave = MockPeriodicWave;
global.OscillatorNode = MockOscillatorNode;

test('tableWaveStrategy generates PeriodicWave', () => {
    const waveTable = 'FF00AA55';
    const audioCtx = {};
    const source = tableWaveStrategy.generateSource(waveTable, audioCtx);

    assert.ok(source instanceof MockPeriodicWave);
});

test('tableWaveStrategy creates OscillatorNode with correct frequency', () => {
    const waveTable = 'FF00AA55';
    const audioCtx = {};
    const source = tableWaveStrategy.generateSource(waveTable, audioCtx);
    const pitch = 57;

    const oscillatorNode = tableWaveStrategy.createSourceNode(audioCtx, source, pitch);

    assert.ok(oscillatorNode instanceof MockOscillatorNode);
    assert.strictEqual(oscillatorNode.frequency, 220);
    assert.strictEqual(oscillatorNode.type, 'custom');
});
