/**
 * Marketing copy lives as data, not JSX.
 *
 * Programme pages, the homepage and the footer all render the same records, so
 * a price or a claim is changed in exactly one place — and this file is what a
 * CMS would replace later without touching a component.
 */

export type Pillar = {
  key: string
  title: string
  blurb: string
  detail: string
}

export const PILLARS: readonly Pillar[] = [
  {
    key: 'pain-free',
    title: 'Pain-Free Performance',
    blurb: 'Build strength, fix posture, stop breaking down.',
    detail:
      'Every member starts with a movement screen. We find the joint that is not doing its job, load it deliberately, and build the lift back up around it.',
  },
  {
    key: 'nutrition',
    title: 'Nutrition Simplified',
    blurb: 'Actionable, science-backed, built around your week.',
    detail:
      'No elimination diets and no 40-page PDFs. A protein target, a plate structure and a plan for the meals you actually eat out.',
  },
  {
    key: 'health',
    title: 'Health Optimised',
    blurb: 'Gut health, hormones and energy, measured not guessed.',
    detail:
      'Bloodwork at intake and again at twelve weeks, read back to you by a physician who explains what moved and what it means for training.',
  },
  {
    key: 'lifestyle',
    title: 'Lifestyle Mastery',
    blurb: 'Sleep, stress and the habits that survive a bad week.',
    detail:
      'The programme is designed to still work at 60%. Consistency beats intensity, and we build the schedule that lets you be consistent.',
  },
]

export type Testimonial = {
  name: string
  role: string
  rating: number
  quote: string
}

export const TESTIMONIALS: readonly Testimonial[] = [
  {
    name: 'Cliff G.',
    role: 'Member, 14 months',
    rating: 5,
    quote:
      'I came in with a back that hurt every morning and left with a 315 deadlift. The difference was that somebody actually looked at how I move before writing a programme.',
  },
  {
    name: 'Logan Millington',
    role: 'Amateur golfer',
    rating: 5,
    quote:
      'Twenty yards on the driver in one off-season. More importantly I can play 36 holes without my lower back seizing up on the back nine.',
  },
  {
    name: 'Rebecca V.',
    role: 'Member, 6 months',
    rating: 5,
    quote:
      'I stopped guessing. Six months later I am squatting pain-free, my bloodwork is back in range, and I am not on a diet — I just eat properly now.',
  },
  {
    name: 'Kirk W.',
    role: 'Firefighter, Healthy Heroes',
    rating: 5,
    quote:
      'Shift work destroyed my training for a decade. They built the plan around the roster instead of pretending the roster did not exist.',
  },
  {
    name: 'Amara Okafor',
    role: 'Member, 2 years',
    rating: 5,
    quote:
      'The check-in call every two weeks is the whole thing. Someone is looking at the numbers with you, so you cannot quietly drift for a month.',
  },
  {
    name: 'Theo Duarte',
    role: 'Returning from ACL repair',
    rating: 4,
    quote:
      'The physio and the strength coach were in the same conversation about my knee. I have never had that anywhere else.',
  },
]

export type Faq = { question: string; answer: string }

export const FAQS: readonly Faq[] = [
  {
    question: 'Is this only for athletes?',
    answer:
      'No. Most members are in their thirties to sixties, working full time, and want to be strong and pain-free rather than to compete. The method is the same; the loading is not.',
  },
  {
    question: 'Do you handle nutrition as well as training?',
    answer:
      'Yes, and they are handled by different people who talk to each other. Your strength coach writes the training; a registered dietitian owns the nutrition. Both see the same progress data.',
  },
  {
    question: 'How quickly should I expect results?',
    answer:
      'Movement quality and energy usually shift inside three weeks. Visible body composition change is a twelve-week conversation. We measure both so you are not relying on the mirror.',
  },
  {
    question: 'What does the testing actually cover?',
    answer:
      'A 48-marker blood panel — metabolic, lipid, thyroid, iron and hormones — plus optional gut health screening. Results are reviewed with a sports physician, not emailed to you as a PDF.',
  },
  {
    question: 'I am in pain. Can I still start?',
    answer:
      'Usually yes, and starting is often the treatment. You will be screened by a DPT first, and if something needs a referral we will tell you that rather than train around it.',
  },
  {
    question: 'Can I do this entirely online?',
    answer:
      'Yes. Sessions run over Zoom, Google Meet or a plain phone call, and everything — programme, check-ins, food log, bloodwork review — lives in the member app.',
  },
]

export type Program = {
  slug: string
  name: string
  tagline: string
  summary: string
  who: string
  duration: string
  accent: string
  outcomes: readonly string[]
  includes: readonly string[]
}

export const PROGRAMS: readonly Program[] = [
  {
    slug: 'transformation',
    name: 'Fitness Transformation',
    tagline: 'The twelve weeks that change the next ten years',
    summary:
      'A complete rebuild: movement screen, progressive strength programme, nutrition baseline and fortnightly coaching calls. This is where most members start and where most of the results come from.',
    who: 'Anyone who has trained on and off for years and wants a plan that finally holds.',
    duration: '12 weeks · 4 sessions/week',
    accent: '#b6ef21',
    outcomes: [
      'Squat, hinge, press and pull without pain',
      'A protein and calorie target you can hit on a normal week',
      'Objective strength numbers, retested at week 12',
      'A maintenance plan for when the programme ends',
    ],
    includes: [
      'Full movement screen and video technique review',
      'Individualised four-day training programme',
      'Nutrition baseline with a registered dietitian',
      'Fortnightly 1:1 coaching calls',
      'Unlimited messaging with your coach',
      'Progress tracking in the member app',
    ],
  },
  {
    slug: 'golf',
    name: 'Golf Fitness',
    tagline: 'Distance you keep, on a back that lasts',
    summary:
      'Rotational power, hip and thoracic mobility, and anti-rotation strength, periodised so you peak going into the season instead of burning out in February.',
    who: 'Club and competitive golfers who want speed without paying for it in the lower back.',
    duration: '8 weeks · 3 sessions/week',
    accent: '#4cc9f0',
    outcomes: [
      'Measured club-head speed increase',
      'Separation between hips and shoulders restored',
      'Play 36 holes without back pain',
      'A warm-up that takes eight minutes, not thirty',
    ],
    includes: [
      'TPI-certified movement assessment',
      'Rotational power and speed programming',
      'Mobility protocol for hips and t-spine',
      'On-course warm-up routine',
      'Bi-weekly video swing/movement review',
    ],
  },
  {
    slug: 'heroes',
    name: 'Healthy Heroes Program',
    tagline: 'Built around the roster, not against it',
    summary:
      'For first responders, nurses and military: training and nutrition designed for rotating shifts, broken sleep and the job standard you have to pass regardless of how the week went.',
    who: 'Firefighters, police, EMS, nurses and serving military. Discounted rate, verified at sign-up.',
    duration: 'Ongoing · 3–4 sessions/week',
    accent: '#ff6a3d',
    outcomes: [
      'Job-standard fitness maintained year round',
      'A plan that survives a run of night shifts',
      'Sleep and recovery strategy for rotating rosters',
      'Injury risk reduced through screening and load management',
    ],
    includes: [
      'Shift-aware programme design',
      'Occupational fitness test preparation',
      'Sleep and circadian coaching',
      'Nutrition for unpredictable meal timing',
      'Discounted membership for verified service',
    ],
  },
]

export const programBySlug = (slug: string) => PROGRAMS.find((p) => p.slug === slug)

export type ResultStory = {
  name: string
  headline: string
  detail: string
  stats: readonly { label: string; value: string }[]
}

export const RESULT_STORIES: readonly ResultStory[] = [
  {
    name: 'Marcus B.',
    headline: 'Down 38 lb, up 90 lb on his deadlift',
    detail:
      'Fourteen months. Started unable to hinge without pain; finished pulling 405 for a triple and off blood pressure medication.',
    stats: [
      { label: 'Weight', value: '−38 lb' },
      { label: 'Deadlift', value: '+90 lb' },
      { label: 'Resting HR', value: '−14 bpm' },
    ],
  },
  {
    name: 'Nina P.',
    headline: 'Back to running 10K after ACL reconstruction',
    detail:
      'Nine months of graded loading with the physio and strength coach working from the same plan. Returned to sport without a re-injury.',
    stats: [
      { label: 'Return to sport', value: '9 months' },
      { label: 'Single-leg hop', value: '97% symmetry' },
      { label: 'Pain score', value: '0/10' },
    ],
  },
  {
    name: 'Kirk W.',
    headline: 'Passed the job standard at 47',
    detail:
      'Shift-aware programming and a sleep protocol that worked around a 24-on/48-off roster. Best fitness test result of his career.',
    stats: [
      { label: 'Test result', value: 'Top 10%' },
      { label: 'Body fat', value: '−7.2%' },
      { label: 'Sessions/week', value: '3.4 avg' },
    ],
  },
]
