// templateGenerator — KAN-20
// Pure function: takes guided builder form values and returns a professional
// HTML email body. {{first_name}} and {{company}} remain as literal placeholders
// (substituted at send time). All user-specific values are baked in at creation.

const CTA_MAP = {
  coffee_chat: "I'd love to grab a virtual coffee chat if you have 20 minutes.",
  virtual_call:
    "Would you be open to a brief virtual call to learn more about your work?",
  quick_call:
    "If you have 15 minutes for a quick call, I'd really appreciate it.",
};

/**
 * @param {object} params
 * @param {string} params.yourName
 * @param {string} params.yourRole        e.g. "Software Engineer"
 * @param {string} params.school
 * @param {string} params.gradYear        e.g. "2027"
 * @param {string} params.achievement1
 * @param {string} params.achievement2
 * @param {string} [params.achievement3]  optional
 * @param {string} params.skills          comma-separated
 * @param {string} params.ctaPreference   'coffee_chat' | 'virtual_call' | 'quick_call'
 * @returns {string} HTML string
 */
export function generateTemplateHtml({
  yourName,
  yourRole,
  school,
  gradYear,
  achievement1,
  achievement2,
  achievement3,
  skills,
  ctaPreference,
}) {
  const ctaText = CTA_MAP[ctaPreference] ?? CTA_MAP.coffee_chat;
  const achievements = [achievement1, achievement2, achievement3].filter(Boolean);
  const liItems = achievements.map((a) => `    <li>${a}</li>`).join("\n");

  return `<div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #222; max-width: 600px;">
  <p>Hi {{first_name}},</p>

  <p>
    My name is ${yourName}, and I'm a ${yourRole} student at ${school} graduating in
    ${gradYear}. I came across {{company}} and was genuinely excited by the work your
    team is doing &mdash; I'd love to learn more about opportunities there.
  </p>

  <p>A few things I'm proud of:</p>
  <ul>
${liItems}
  </ul>

  <p>My core skills include ${skills}.</p>

  <p>${ctaText}</p>

  <p>Thanks so much for your time &mdash; I really appreciate it.</p>

  <p>Best,<br/>${yourName}</p>
</div>`;
}
