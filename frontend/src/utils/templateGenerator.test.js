// Tests for generateTemplateHtml — KAN-20
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
    const result = generateTemplateHtml(BASE_PARAMS);
    expect(typeof result).toBe("string");
  });

  test("includes yourName in the output", () => {
    const result = generateTemplateHtml(BASE_PARAMS);
    expect(result).toContain("Alex Kim");
  });

  test("retains {{first_name}} as a literal placeholder", () => {
    const result = generateTemplateHtml(BASE_PARAMS);
    expect(result).toContain("{{first_name}}");
  });

  test("retains {{company}} as a literal placeholder", () => {
    const result = generateTemplateHtml(BASE_PARAMS);
    expect(result).toContain("{{company}}");
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
    const result = generateTemplateHtml({ ...BASE_PARAMS, achievement3: "" });
    // Should have exactly two <li> items
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
    const result = generateTemplateHtml({ ...BASE_PARAMS, ctaPreference: "coffee_chat" });
    expect(result).toContain("virtual coffee chat");
  });

  test("uses virtual_call CTA text", () => {
    const result = generateTemplateHtml({ ...BASE_PARAMS, ctaPreference: "virtual_call" });
    expect(result).toContain("brief virtual call");
  });

  test("uses quick_call CTA text", () => {
    const result = generateTemplateHtml({ ...BASE_PARAMS, ctaPreference: "quick_call" });
    expect(result).toContain("15 minutes");
  });

  test("defaults to coffee_chat CTA for unknown preference", () => {
    const result = generateTemplateHtml({ ...BASE_PARAMS, ctaPreference: "unknown" });
    expect(result).toContain("virtual coffee chat");
  });
});
