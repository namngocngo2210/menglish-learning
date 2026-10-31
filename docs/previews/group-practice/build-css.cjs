const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = process.env.TAILWIND_MODULES || '/home/menglish/wt-topics-classification/web/node_modules';
const external = createRequire(path.join(root, 'postcss/package.json'));
const postcss = external('postcss');
const tailwind = external('@tailwindcss/postcss');
const dir = __dirname;
// Resolve Tailwind from the supplied external dependency tree; never install in this worktree.
const input = fs.readFileSync(path.join(dir, 'input.css'), 'utf8').replace('@import "tailwindcss";', `@import "${path.join(root, 'tailwindcss/index.css')}";`);
postcss([tailwind({base:dir, optimize:true})]).process(input, {from:path.join(dir,'input.css'),to:path.join(dir,'styles.css')}).then(result=>{fs.writeFileSync(path.join(dir,'styles.css'),result.css);console.log('Compiled styles.css with Tailwind CSS v4');}).catch(err=>{console.error(err);process.exitCode=1;});
