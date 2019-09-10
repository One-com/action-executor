import pkg from "./package.json";
import commonjs from "rollup-plugin-commonjs";
import resolve from "rollup-plugin-node-resolve";
import { terser } from "rollup-plugin-terser";

const fileBrowser = "dist/ActionExecutor.umd.js";

module.exports = [
  {
    input: pkg.main,
    output: {
      file: fileBrowser,
      format: "umd",
      name: "ActionExecutor",
      exports: "default",
      legacy: true,
      strict: false
    },
    plugins: [commonjs(), resolve()]
  },
  {
    input: pkg.main,
    output: {
      file: fileBrowser.replace("umd", "min"),
      format: "umd",
      name: "ActionExecutor",
      exports: "default",
      legacy: true,
      strict: false
    },
    plugins: [commonjs(), resolve(), terser()]
  }
];
