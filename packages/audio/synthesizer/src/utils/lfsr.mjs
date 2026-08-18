/**
 * Generates a linear-feedback shift register (LFSR) function.
 * @param {number} [tapPosition=1] - 1: long-period (32,767 bit (default)), 6: short-period (93 bit)
 */
export function lfsr(tapPosition = 1) {
    let register = 1;
    let get1Bit = (b, n) => (b & (1 << n)) >> n;
    return () => {
        let prn = get1Bit(register, 0) ^ get1Bit(register, tapPosition);
        register >>= 1;
        register |= prn << 14;
        return prn;
    };
}
