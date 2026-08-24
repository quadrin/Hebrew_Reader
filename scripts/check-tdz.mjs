/* Use-before-declaration inside a function.

   `const` and `let` are not hoisted the way `var` is: reading one above its
   own declaration throws "Cannot access 'x' before initialization". Inside a
   React component that is a blank screen, and a minified build renames the
   variable, so the message names a letter and points nowhere.

   That is exactly what happened: a derived value was written above the
   useState it read, the lesson screen threw on every render, and the only
   clue was `Cannot access 'F' before initialization`. This catches it in a
   second instead.

   Only same-function references count. A reference from inside a nested
   function — a callback, an effect, a handler — runs later, by which time the
   declaration has been reached, so those are fine and are not reported.

   Run: npm run check:tdz */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let parse, traverse;
try {
  ({ parse } = require("@babel/parser"));
  traverse = require("@babel/traverse");
  traverse = traverse.default || traverse;
} catch (e) {
  /* @babel/* rides in with the React plugin rather than being asked for
     directly; if a future install drops it, say so and pass rather than
     failing a build over a missing linter. */
  console.log("check:tdz — @babel/parser not installed, skipping");
  process.exit(0);
}

const files = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(js|jsx)$/.test(name)) files.push(p);
  }
})("src");

const lineOf = (code, i) => code.slice(0, i).split("\n").length;

const problems = [];
for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  const ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
  traverse(ast, {
    Scope(p) {
      for (const [name, binding] of Object.entries(p.scope.bindings)) {
        if (!["let", "const", "class"].includes(binding.kind)) continue;
        const declFn = binding.path.getFunctionParent();
        /* Only bindings inside a function: at module scope the evaluation
           order is the import graph's business, not this check's. */
        if (!declFn) continue;
        const start = binding.path.node.start;
        for (const ref of binding.referencePaths) {
          if (ref.node.start >= start) continue;
          if (ref.getFunctionParent() !== declFn) continue;
          problems.push(
            `${file}:${lineOf(code, ref.node.start)} reads '${name}', declared below at line ${lineOf(code, start)}`,
          );
        }
      }
    },
  });
}

if (problems.length) {
  console.error(`check:tdz — ${problems.length} use${problems.length > 1 ? "s" : ""} before declaration:\n`);
  for (const p of problems) console.error("  " + p);
  console.error("\nMove the declaration above the line that reads it.");
  process.exit(1);
}
console.log(`check:tdz — ${files.length} files, nothing read before it is declared`);
