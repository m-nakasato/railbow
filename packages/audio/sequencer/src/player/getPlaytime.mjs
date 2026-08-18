export const getPlaytime = (kms) => {
    const beat = kms.time.split('/')[0];
    const numOfMeasures = kms.seq.length - (kms.loop ?? 0);
    return (60 / kms.bpm) * beat * numOfMeasures;
};
