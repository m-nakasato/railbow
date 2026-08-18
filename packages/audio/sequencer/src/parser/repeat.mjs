export const repeat = (list, symbol) => {
    let result = [];
    list.forEach((item) => {
        if (item.startsWith(symbol)) {
            let repeatNum = item.slice(1) || 1;
            let repeatBuf = result.slice(-repeatNum);
            result.push(...repeatBuf);
        } else {
            result.push(item);
        }
    });
    return result;
};
