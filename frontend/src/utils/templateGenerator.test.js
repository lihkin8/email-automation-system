import { describe, test, expect } from "vitest";
import { generateTemplateHtml } from "./templateGenerator";

const BASE_PARAMS = {
  yourName: "Alex Kim",
  yourRole: "Software Engineer",
  school: "UC Berkeley",
  gradYear: "2027",
  achievement1: "Built a real-time chat app with 500 users",
  achievement2: "Won first place at HackMIT",
  achievement3: "",
  skills: "React, Python, SQL",
  ctaPreference: "coffee_chat",
};

describe("generateTemplateHtml", () => {
  test("returns a string", () => {
    expect(typeof generateTemplateHtml(BASE_PARAMS)).toBe("string");
  });

  test("includes yourName in the output", () => {
    expect(generateTemplateHtml(BASE_PARAMS)).toContain("Alex Kim");
  });

  test("retains {{first_name}} as a literal placeholder", () => {
    expect(generateTemplateHtml(BASE_PARAMS)).toContain("{{first_name}}");
  });

  test("retains {{company}} as a literal placeholder", () => {
    expect(generateTemplateHtml(BASE_PARAMS)).toContain("{{company}}");
  });

  test("includes all non-empty achievements", () => {
    const result = generateTemplateHtml({
      ...BASE_PARAMS,
      achievement1: "Achievement A",
      achievement2: "Achievement B",
      achievement3: "Achievement C",
    });
    expect(result).toContain("Achievement A");
    expect(result).toContain("Achievement B");
    expect(result).toContain("Achievement C");
  });

  test("omits empty achievement3 from the list", () => {
    const result = generateTemplateHtml({
      ...BASE_PARAMS,
      achievement3: "",
    });
    const liMatches = result.match(/<li>/g);
    expect(liMatches).toHaveLength(2);
  });

  test("omits achievement3 entirely when undefined", () => {
    const { achievement3, ...params } = BASE_PARAMS;
    const result = generateTemplateHtml(params);
    const liMatches = result.match(/<li>/g);
    expect(liMatches).toHaveLength(2);
  });

  test("uses coffee_chat CTA text", () => {
    expect(
      generateTemplateHtml({ ...BASE_PARAMS, ctaPreference: "coffee_chat" })
    ).toContain("virtual coffee chat");
  });

  test("uses virtual_call CTA text", () => {
    expect(
      generateTemplateHtml({ ...BASE_PARAMS, ctaPreference: "virtual_call" })
    ).toContain("brief virtual call");
  });

  test("uses quick_call CTA text", () => {
    expect(
      generateTemplateHtml({ ...BASE_PARAMS, ctaPreference: "quick_call" })
    ).toContain("15 minutes");
  });

  test("defaults to coffee_chat CTA for an unknown preference", () => {
    expect(
      generateTemplateHtml({ ...BASE_PARAMS, ctaPreference: "unknown" })
    ).toContain("virtual coffee chat");
  });
});
