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
export function validatePlayArgs(noteNumber, options, waves) {
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
