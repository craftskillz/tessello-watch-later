// What the User drops on the View. A link dragged from a tab, the address bar or a page carries a URI list (RFC 2483),
// whose lines starting with `#` are comments; dropped text carries only plain text.

/** The text of a drop, one URL per line: its URI list, else its plain text. */
export function droppedText(data: Pick<DataTransfer, "getData">): string {
  const uris = data
    .getData("text/uri-list")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("#"));
  return uris.length ? uris.join("\n") : data.getData("text/plain");
}
