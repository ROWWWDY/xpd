// Canonical text of the cadet acknowledgement form, mirrored from index.html.
// Kept server-side (not trusted from the client) so admin.html can safely
// render it with innerHTML without any risk of injected markup.
// If the wording in index.html ever changes, update this file to match —
// each submission stores a snapshot of this at the time it was submitted,
// so past applications keep the wording that was actually shown to them.

const ACK_SECTIONS = [
  {
    legend: '02 — Conduct & Roleplay Standards',
    items: [
      "I will not <b>metagame</b> (use info I only know out of character) or <b>powergame</b> (force things on other players without letting them react).",
      "I will stay in character during a scene. I will not <b>fail RP</b> or combat log to avoid a consequence.",
      "As a cadet, I will follow my Field Training Officer's instructions and listen to higher ranks in every scene until my probation is done."
    ]
  },
  {
    legend: '03 — Use of Force',
    items: [
      "I will use <b>fair force</b> — verbal commands and de-escalation first, before lethal options, matching how far the suspect escalates.",
      "I will give people a fair chance to comply. I will not start a fight over small or victimless RP, and I will not use force on my own while I am still a cadet."
    ]
  },
  {
    legend: '04 — Radio & Communication',
    items: [
      "I will use correct radio etiquette and department codes on official channels, and keep out-of-character chat off the in-character radio."
    ]
  },
  {
    legend: '05 — Gang Affiliation & Activity Requirements',
    items: [
      "If I am in a gang, I understand I can only join the Police Department if I agree to be online during <b>peak hours (9:00 PM – 1:00 AM)</b> and do at least <b>15 hours of PD duty every week</b>, completed during peak hours.",
      "I understand I need to stay active in the city while I am in the Police Department, especially during peak hours. Being inactive too often may lead to punishment or removal."
    ]
  },
  {
    legend: '06 — Communication Standards',
    items: [
      "I can talk clearly and understand instructions well, and I have a <b>working microphone</b> that gives clear voice communication."
    ]
  },
  {
    legend: '07 — Duty Recording',
    items: [
      "I understand I must <b>record every duty shift</b>, using OBS, NVIDIA ShadowPlay, Medal, SteelSeries Moments, or a similar app. The recording must show my gameplay and my in-game voice clearly (low quality is fine, but it must be clear). I must start recording before duty starts and keep recording for the whole shift."
    ]
  },
  {
    legend: '08 — Supervised Duty & Decision-Making',
    items: [
      "As a new <b>Cadet</b>, I understand I cannot go on duty alone. I can only go on duty when a <b>Senior Officer (Officer 2nd Class or higher)</b> is already on duty to guide me.",
      "I understand that as a Cadet I cannot make big decisions on my own. I must follow senior officers' instructions until I am promoted to an Officer rank."
    ]
  },
  {
    legend: '09 — Minimum Service Commitment',
    items: [
      "I understand that by joining the Police Department, I am agreeing to stay for at least <b>30 play days</b> (not 30 days since I joined), and I must complete the required hours during that time.",
      "I understand that if I try to resign before finishing this commitment, it will <b>not be accepted</b> unless PD Management approves it. If I fail to complete this without approval, I could have my character <b>wiped</b> and face job restrictions, based on PD Management's decision."
    ]
  },
  {
    legend: '10 — Consequences',
    items: [
      "I understand that breaking these rules may lead to a warning, longer probation, demotion, or removal from the Cadet Program, depending on how serious it is.",
      "I understand that staff decisions on scenes are final. If I disagree, I will use the ticket system, not argue in character or in public chat."
    ]
  },
  {
    legend: '11 — Final Acknowledgement',
    items: [
      "I have read and understood everything above, and I agree to follow all of these rules. I understand that not following them may lead to punishment or removal from the Police Department."
    ]
  }
];

module.exports = { ACK_SECTIONS };
