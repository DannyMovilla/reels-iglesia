import { expect, test } from "vitest";
import { comandoClaudeDesde } from "../../../src/main/sistema/claude-cmd";

const NPM = String.raw`C:\Users\daniel\AppData\Roaming\npm\claude.cmd`;
const WINGET = String.raw`C:\winget\claude.exe`;

test("prefiere claude.exe cuando existe", () => {
  expect(comandoClaudeDesde(`${NPM}\r\n${WINGET}\r\n`)).toEqual([WINGET, []]);
});

test("si solo hay claude.cmd (instalación con npm) lo ejecuta a través de cmd.exe", () => {
  expect(comandoClaudeDesde(`${NPM}\r\n`)).toEqual(["cmd.exe", ["/d", "/c", "claude"]]);
});

test("si no aparece en el PATH devuelve claude tal cual", () => {
  expect(comandoClaudeDesde("")).toEqual(["claude", []]);
});
