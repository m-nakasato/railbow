export const dft = (data, len) => {
    let real = new Float32Array(len),
        imag = new Float32Array(len);
    //添字が１始まりで良い？
    for (let k = 1; k <= len; k++) {
        // for (let k = 0; k < len; k++) {
        for (let n = 0; n < len; n++) {
            let idx = Math.floor((n / len) * data.length);
            let th = (2 * Math.PI * k * n) / len;
            real[k] += data[idx] * Math.cos(th);
            imag[k] += data[idx] * Math.sin(th);
        }
    }
    return { 'real': real, 'imag': imag };
};
