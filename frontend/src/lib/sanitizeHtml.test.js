import { describe, expect, test } from "vitest";

import { sanitizeHtml } from "@/lib/sanitizeHtml";

describe("sanitizeHtml", () => {
  test("strips scripts and event handler attributes while preserving safe markup", () => {
    const clean = sanitizeHtml(
      '<p>Hello <strong>there</strong></p><img src="x" onerror="alert(1)" /><script>alert(2)</script>'
    );

    expect(clean).toContain("<strong>there</strong>");
    expect(clean).toContain('<img src="x">');
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onerror");
  });
});
