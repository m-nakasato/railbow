import { repeat } from './repeat.mjs';

export const createParser = (separator, repeater, nextParser) => (str) => {
    const separated = str.split(separator);
    const expanded = repeater ? repeat(separated, repeater) : separated;
    return nextParser ? expanded.map((nextStr) => nextParser(nextStr)) : expanded;
};
