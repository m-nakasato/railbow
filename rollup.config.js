import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import path from 'path';

export default () => {
    const cwd = process.cwd();

    return {
        input: path.join(cwd, 'src/main.js'),
        output: [
            {
                file: path.join(cwd, 'dist/bundle.js'),
                format: 'esm',
                sourcemap: true,
            },
            {
                file: path.join(cwd, 'dist/b.js'),
                format: 'esm',
                sourcemap: true,
                plugins: [
                    terser({
                        compress: {
                            drop_console: process.env.NODE_ENV === 'production',
                            passes: 2,
                        },
                        mangle: {
                            properties: {
                                keep_quoted: true,
                            },
                        },
                        toplevel: true,
                    }),
                ],
            },
        ],
        plugins: [
            nodeResolve(),
            replace({
                __DEV__: String(process.env.NODE_ENV === 'development'),
            }),
        ],
    };
};
