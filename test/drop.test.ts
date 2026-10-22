import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { droppedText } from "../src/lib/drop.ts";

/** What a drop carries, by type, as `DataTransfer.getData` gives it: "" for a type it does not carry. */
const drop = (data: Record<string, string>) => ({ getData: (type: string) => data[type] ?? "" });

describe("reading what the User drops", () => {
  test("a link dropped from a tab or a page is read from its URI list, without its comment lines", () => {
    const text = droppedText(
      drop({ "text/uri-list": "# Never Gonna Give You Up\r\nhttps://youtu.be/aaaaaaaaaaa\r\nhttps://youtu.be/bbbbbbbbbbb", "text/plain": "Never Gonna Give You Up" }),
    );
    assert.equal(text, "https://youtu.be/aaaaaaaaaaa\nhttps://youtu.be/bbbbbbbbbbb");
  });

  test("without a URI list, the plain text is read", () => {
    assert.equal(droppedText(drop({ "text/plain": "youtu.be/aaaaaaaaaaa\nyoutu.be/bbbbbbbbbbb" })), "youtu.be/aaaaaaaaaaa\nyoutu.be/bbbbbbbbbbb");
    assert.equal(droppedText(drop({ "text/uri-list": "# only a comment", "text/plain": "youtu.be/aaaaaaaaaaa" })), "youtu.be/aaaaaaaaaaa");
  });

  test("a drop with no text is empty", () => {
    assert.equal(droppedText(drop({})), "");
  });
});
