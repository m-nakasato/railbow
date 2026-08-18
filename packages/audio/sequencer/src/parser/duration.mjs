export const duration = (value, bpm) => {
    let _value = value;
    if (/\.$/.test(value)) _value = value.slice(0, -1) / 1.5;
    if (/t$/.test(value)) _value = value.slice(0, -1) * 1.5;
    return (60 / bpm) * (4 / _value);
};
