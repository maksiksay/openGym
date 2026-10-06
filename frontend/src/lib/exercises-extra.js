// Built-in exercises this fork adds to the upstream dataset (docs/dev/AB_PLAN.md).
//
// exercises-data.js appends them to EXDB in a statement of its own, so the upstream line stays
// exactly as shipped and every reader of the catalogue sees them: the library, search, imports,
// the equipment lists, the MCP server and the Coach library builder. Ids start at 9001, far above
// the dataset's last (5201). There is no media for them, so they carry no img or gif and the card
// shows none. Muscles are given here directly (primaries/secondaries in lib/muscles.js's terms);
// every bp/eq/tg/mg/sm value is one the catalogue already uses, so the locale packs cover them.
//
// Names in other languages: scripts/exercise-name-sources/*.json. Steps in Portuguese (Brazil):
// scripts/instruction-sources/pt-BR.json. Steps in Russian: EXTRA_STEPS below, merged into the
// Russian pack as it loads (lib/i18n.js), because instr/ru.js is generated from the upstream
// dataset and a regeneration would drop anything added there. Every other language falls back to
// the English steps.
export const EXTRA_EXERCISES = [
  {
    id: '9001',
    n: 'nordic hamstring curl',
    bp: 'upper legs',
    eq: 'body weight',
    tg: 'hamstrings',
    mg: 'glutes',
    sm: ['glutes', 'calves'],
    primaries: ['hamstring'],
    secondaries: ['gluteal', 'calves'],
    st: [
      'Kneel on a pad with your ankles held down by a partner, or hooked under a loaded bar or a sturdy bench.',
      'Keep your body straight from knees to head, with your hips extended and your hands in front of your chest.',
      'Lean forward from the knees and lower your torso toward the floor as slowly as you can, resisting with your hamstrings.',
      'When you can no longer slow the descent, catch yourself with your hands and lower to the floor.',
      'Push off lightly with your hands to return to the kneeling start, and repeat.',
    ],
  },
  {
    id: '9002',
    n: 'copenhagen adduction',
    bp: 'upper legs',
    eq: 'body weight',
    tg: 'adductors',
    mg: 'obliques',
    sm: ['obliques', 'abs'],
    primaries: ['adductors'],
    secondaries: ['obliques', 'abs', 'hip-flexors'],
    st: [
      'Lie on your side next to a bench and rest the inside of your top leg on it, at the knee for an easier lever or at the ankle for a harder one.',
      'Prop yourself up on your forearm with your elbow under your shoulder and your bottom leg under the bench.',
      'Press the top leg down into the bench to lift your hips until your body forms a straight line, bringing the bottom leg up to meet the bench.',
      'Lower your hips and bottom leg under control without resting on the floor.',
      'Complete the reps, then turn over and repeat on the other side.',
    ],
  },
]

// Steps of the exercises above in languages whose instruction pack is generated from the upstream
// dataset, keyed like the packs: { lang: { id: [steps] } }.
export const EXTRA_STEPS = {
  ru: {
    '9001': [
      'Встаньте на колени на коврик; партнёр держит ваши лодыжки, или зацепите их под нагруженной штангой либо устойчивой скамьёй.',
      'Держите тело прямым от коленей до головы, таз выпрямлен, руки перед грудью.',
      'Наклоняйтесь вперёд от коленей и опускайте корпус к полу как можно медленнее, сопротивляясь задней поверхностью бедра.',
      'Когда тормозить падение уже не получается, примите вес на руки и опуститесь на пол.',
      'Слегка оттолкнитесь руками, вернитесь в исходное положение на коленях и повторите.',
    ],
    '9002': [
      'Лягте на бок рядом со скамьёй и положите на неё внутреннюю сторону верхней ноги: у колена — легче, у лодыжки — тяжелее.',
      'Обопритесь на предплечье, локоть под плечом, нижняя нога под скамьёй.',
      'Давите верхней ногой в скамью и поднимите таз, пока тело не вытянется в линию; нижнюю ногу подтяните к скамье.',
      'Подконтрольно опустите таз и нижнюю ногу, не ложась на пол.',
      'Выполните все повторения, затем перевернитесь и повторите на другую сторону.',
    ],
  },
}
