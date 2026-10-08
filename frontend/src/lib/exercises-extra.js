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
  // Warm-ups and recovery (docs/dev/WARMUPS.md): what the ready-made sets need that the dataset
  // lacks. The same rules as above — existing catalogue terms, muscles named directly, no media.
  {
    id: '9003',
    n: 'band pull-apart',
    bp: 'shoulders',
    eq: 'band',
    tg: 'delts',
    mg: 'rhomboids',
    sm: ['rear deltoids', 'trapezius'],
    primaries: ['deltoids', 'upper-back'],
    secondaries: ['trapezius'],
    st: [
      'Stand tall holding a light band in front of your chest with both hands, palms down, hands shoulder-width apart and arms straight.',
      'Set your shoulders down and back, away from your ears.',
      'Pull the band apart by moving your hands out to the sides until it touches your chest, squeezing your shoulder blades together.',
      'Pause for a second without arching your lower back.',
      'Return slowly to the start, keeping tension in the band, and repeat.',
    ],
  },
  {
    id: '9004',
    n: 'band face pull',
    bp: 'shoulders',
    eq: 'band',
    tg: 'delts',
    mg: 'rotator cuff',
    sm: ['rear deltoids', 'trapezius', 'rhomboids'],
    primaries: ['deltoids'],
    secondaries: ['trapezius', 'upper-back'],
    st: [
      'Anchor a band at face height and hold an end in each hand, palms facing down.',
      'Step back until the band is taut and stand tall with your arms straight in front of you.',
      'Pull the band toward your face, leading with your elbows high and out to the sides.',
      'At the end, rotate your hands back so your knuckles point up, squeezing your shoulder blades together.',
      'Return slowly to straight arms and repeat.',
    ],
  },
  {
    id: '9005',
    n: 'open book thoracic rotation',
    bp: 'back',
    eq: 'body weight',
    tg: 'upper back',
    mg: 'obliques',
    sm: ['chest', 'shoulders'],
    primaries: ['upper-back'],
    secondaries: ['obliques', 'chest'],
    st: [
      'Lie on your side with your knees bent to 90 degrees, stacked, and your arms straight out in front of you at shoulder height, palms together.',
      'Keep your knees together and on the floor throughout.',
      'Lift the top arm and open it over your body toward the other side, following your hand with your eyes and rotating through your upper back.',
      'Pause where you feel the stretch, breathing out, without forcing it.',
      'Bring the arm back to the start and repeat, then turn onto the other side.',
    ],
  },
  {
    id: '9006',
    n: 'leg swings',
    bp: 'upper legs',
    eq: 'body weight',
    tg: 'hamstrings',
    mg: 'hip flexors',
    sm: ['glutes', 'inner thighs'],
    primaries: ['hip-flexors', 'hamstring'],
    secondaries: ['gluteal', 'adductors'],
    st: [
      'Stand side-on to a wall or a rack and hold it with one hand for balance.',
      'Swing the outside leg forward and back in a relaxed, controlled arc, keeping your torso upright.',
      'Let the range grow a little with each swing, without forcing it.',
      'Then face the wall, holding it with both hands, and swing the leg from side to side across your body.',
      'Do the same number with the other leg.',
    ],
  },
  {
    id: '9007',
    n: 'single leg balance',
    bp: 'lower legs',
    eq: 'body weight',
    tg: 'calves',
    mg: 'ankle stabilizers',
    sm: ['feet', 'glutes'],
    primaries: ['calves'],
    secondaries: ['gluteal', 'tibialis'],
    st: [
      'Stand barefoot or in flat shoes next to something you can hold if you need it.',
      'Lift one foot off the floor and balance on the other, with a soft knee and your hips level.',
      'Keep the arch of the standing foot lifted, your weight spread over the heel, the big toe and the little toe.',
      'Hold for the set time; to make it harder, close your eyes or turn your head slowly.',
      'Switch legs and repeat.',
    ],
  },
  {
    id: '9008',
    n: 'short foot',
    bp: 'lower legs',
    eq: 'body weight',
    tg: 'calves',
    mg: 'ankle stabilizers',
    sm: ['feet', 'shins'],
    primaries: ['calves'],
    secondaries: ['tibialis'],
    st: [
      'Sit or stand barefoot with your foot flat on the floor.',
      'Without curling your toes, draw the ball of your foot toward your heel so the arch rises and the foot gets shorter.',
      'Keep the big toe and the heel pressed into the floor the whole time.',
      'Hold for a few seconds, breathing normally, then relax.',
      'Repeat for the set time, then do the other foot; standing on one leg makes it harder.',
    ],
  },
  {
    id: '9009',
    n: 'kneeling hip flexor stretch',
    bp: 'upper legs',
    eq: 'body weight',
    tg: 'quads',
    mg: 'hip flexors',
    sm: ['glutes', 'abs'],
    primaries: ['hip-flexors'],
    secondaries: ['quadriceps'],
    st: [
      'Kneel on one knee on a pad, the other foot flat in front of you, with both knees at about 90 degrees.',
      'Tuck your pelvis under by tightening the glute of the kneeling leg, keeping your torso upright.',
      'Shift your hips forward slowly until you feel a stretch at the front of the hip of the kneeling leg.',
      'Hold for the set time, breathing calmly; reaching the same-side arm overhead deepens it.',
      'Switch sides and repeat.',
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
    '9003': [
      'Встаньте прямо, держите лёгкую резинку перед грудью двумя руками, ладони вниз, хват на ширине плеч, руки прямые.',
      'Опустите плечи вниз и назад, подальше от ушей.',
      'Разведите руки в стороны, растягивая резинку, пока она не коснётся груди, и сведите лопатки.',
      'Задержитесь на секунду, не прогибаясь в пояснице.',
      'Медленно вернитесь в исходное положение, не отпуская натяжение, и повторите.',
    ],
    '9004': [
      'Закрепите резинку на уровне лица и возьмите концы в руки, ладони вниз.',
      'Отойдите назад, чтобы резинка натянулась; встаньте прямо, руки вытянуты перед собой.',
      'Тяните резинку к лицу, разводя локти высоко в стороны.',
      'В конце разверните кисти назад, костяшками вверх, и сведите лопатки.',
      'Медленно выпрямите руки и повторите.',
    ],
    '9005': [
      'Лягте на бок, колени согнуты под прямым углом и сложены вместе, прямые руки вытянуты перед собой на уровне плеч, ладони вместе.',
      'Колени всё время остаются вместе и на полу.',
      'Поднимите верхнюю руку и раскройте её через себя в другую сторону, провожая кисть взглядом; поворот идёт в грудном отделе.',
      'Задержитесь там, где чувствуете растяжение, на выдохе, без рывков.',
      'Верните руку в исходное положение и повторите, затем перевернитесь на другой бок.',
    ],
    '9006': [
      'Встаньте боком к стене или стойке и держитесь за неё рукой.',
      'Делайте махи дальней ногой вперёд и назад, свободно и под контролем, корпус ровный.',
      'С каждым махом понемногу увеличивайте амплитуду, без рывков.',
      'Затем встаньте лицом к стене, держась двумя руками, и делайте махи в стороны перед собой.',
      'Повторите то же другой ногой.',
    ],
    '9007': [
      'Встаньте босиком или в плоской обуви рядом с опорой, за которую можно взяться.',
      'Поднимите одну ногу и стойте на другой, колено чуть согнуто, таз ровно.',
      'Держите свод опорной стопы приподнятым, вес на пятке, большом пальце и мизинце.',
      'Удерживайте положение заданное время; чтобы усложнить, закройте глаза или медленно поворачивайте голову.',
      'Смените ногу и повторите.',
    ],
    '9008': [
      'Сядьте или встаньте босиком, стопа плоско на полу.',
      'Не поджимая пальцы, подтяните подушечку стопы к пятке, чтобы свод поднялся, а стопа стала короче.',
      'Большой палец и пятка всё время прижаты к полу.',
      'Удерживайте несколько секунд, дышите свободно, затем расслабьтесь.',
      'Повторяйте заданное время, затем другой ногой; стоя на одной ноге сложнее.',
    ],
    '9009': [
      'Встаньте на одно колено на коврик, другая стопа впереди на полу, оба колена согнуты примерно под прямым углом.',
      'Подкрутите таз, напрягая ягодицу ноги, стоящей на колене; корпус прямо.',
      'Медленно подайте таз вперёд, пока не почувствуете растяжение спереди бедра ноги, стоящей на колене.',
      'Удерживайте заданное время, дышите спокойно; рука той же стороны над головой усиливает растяжение.',
      'Смените сторону и повторите.',
    ],
  },
}
