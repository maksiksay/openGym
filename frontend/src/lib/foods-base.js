/* Built-in foods: the everyday basics, so a new profile can log breakfast without building a
 * food library first. Values per 100 g of the food as eaten (cooked where the name says so),
 * rounded reference values in the range of USDA FoodData Central and the common Russian
 * composition tables — good to a few percent, which is the precision any home portion has
 * anyway. Packaged products are not here on purpose: those come from their label or from Open
 * Food Facts by barcode (lib/off.js) and land in the person's own foods.
 *
 *   id    stable, never reused — meal rows refer to it as 'b:<id>'
 *   n     names; the UI shows the current language and falls back to English
 *   kcal, p, f, c   per 100 g
 *   u     optional household portion: [grams, { en, ru }] — "1 egg", "1 slice"
 */

const F = (id, en, ru, kcal, p, f, c, u) => ({ id, n: { en, ru }, kcal, p, f, c, ...(u ? { u } : {}) })
const U = (g, en, ru) => [g, { en, ru }]

export const BASE_FOODS = Object.freeze([
  /* ---- grains, cooked and dry ---- */
  F('buckwheat-c', 'Buckwheat, cooked', 'Гречка варёная', 101, 4.2, 1.1, 19.9),
  F('buckwheat-d', 'Buckwheat, dry', 'Гречка (крупа)', 313, 12.6, 3.3, 62),
  F('rice-w-c', 'White rice, cooked', 'Рис белый варёный', 130, 2.7, 0.3, 28.2),
  F('rice-w-d', 'White rice, dry', 'Рис белый (крупа)', 344, 6.7, 0.7, 78.9),
  F('rice-b-c', 'Brown rice, cooked', 'Рис бурый варёный', 123, 2.7, 1, 25.6),
  F('oats-d', 'Rolled oats, dry', 'Овсяные хлопья', 366, 12.3, 6.2, 61.8),
  F('oats-w', 'Oatmeal on water', 'Овсянка на воде', 88, 3, 1.7, 15),
  F('oats-m', 'Oatmeal on milk 2.5%', 'Овсянка на молоке 2,5%', 105, 4.1, 2.6, 15.9),
  F('pasta-c', 'Pasta, cooked', 'Макароны варёные', 158, 5.8, 0.9, 30.9),
  F('pasta-d', 'Pasta, dry', 'Макароны (сухие)', 350, 12, 1.5, 71),
  F('bulgur-c', 'Bulgur, cooked', 'Булгур варёный', 83, 3.1, 0.2, 18.6),
  F('quinoa-c', 'Quinoa, cooked', 'Киноа варёная', 120, 4.4, 1.9, 21.3),
  F('millet-c', 'Millet, cooked', 'Пшено варёное', 119, 3.5, 1, 23.7),
  F('pearl-barley-c', 'Pearl barley, cooked', 'Перловка варёная', 109, 3.1, 0.4, 22.2),
  F('semolina-m', 'Semolina porridge on milk', 'Манная каша на молоке', 98, 3, 3.2, 15.3),
  F('couscous-c', 'Couscous, cooked', 'Кускус варёный', 112, 3.8, 0.2, 23.2),
  F('lentils-c', 'Lentils, cooked', 'Чечевица варёная', 116, 9, 0.4, 20.1),
  F('chickpeas-c', 'Chickpeas, cooked', 'Нут варёный', 164, 8.9, 2.6, 27.4),
  F('beans-c', 'Kidney beans, cooked', 'Фасоль варёная', 127, 8.7, 0.5, 22.8),
  F('green-peas', 'Green peas', 'Зелёный горошек', 81, 5.4, 0.4, 14.5),
  F('corn-can', 'Sweet corn, canned', 'Кукуруза консервированная', 82, 2.6, 1.2, 15.6),

  /* ---- bread and bakery ---- */
  F('bread-w', 'White bread', 'Хлеб белый (батон)', 265, 8, 3.2, 49, U(30, '1 slice', '1 ломтик')),
  F('bread-rye', 'Rye bread', 'Хлеб ржаной', 259, 8.5, 3.3, 48, U(30, '1 slice', '1 ломтик')),
  F('bread-wg', 'Whole-grain bread', 'Хлеб цельнозерновой', 247, 13, 3.4, 41, U(30, '1 slice', '1 ломтик')),
  F('lavash', 'Lavash (thin flatbread)', 'Лаваш тонкий', 275, 9, 1.2, 56),
  F('crispbread', 'Crispbread', 'Хлебцы', 330, 10, 2, 66, U(10, '1 piece', '1 шт')),
  F('tortilla', 'Wheat tortilla', 'Тортилья пшеничная', 306, 8.2, 8, 50, U(45, '1 tortilla', '1 шт')),

  /* ---- meat and poultry (cooked unless said) ---- */
  F('chicken-breast-r', 'Chicken breast, raw', 'Куриная грудка сырая', 113, 23.1, 1.6, 0),
  F('chicken-breast-c', 'Chicken breast, cooked', 'Куриная грудка отварная/запечённая', 165, 31, 3.6, 0),
  F('chicken-thigh-c', 'Chicken thigh, skinless, cooked', 'Куриное бедро без кожи, приготовленное', 209, 26, 10.9, 0),
  F('turkey-breast-c', 'Turkey breast, cooked', 'Грудка индейки, приготовленная', 147, 30, 2.1, 0),
  F('beef-lean-c', 'Lean beef, cooked', 'Говядина постная, приготовленная', 217, 26.1, 11.8, 0),
  F('beef-mince-r', 'Beef mince 15%, raw', 'Фарш говяжий 15%, сырой', 215, 18.6, 15, 0),
  F('pork-loin-c', 'Pork loin, cooked', 'Свиная корейка, приготовленная', 242, 27.3, 13.9, 0),
  F('pork-neck-c', 'Pork neck, cooked', 'Свиная шея, приготовленная', 300, 23, 23, 0),
  F('liver-chicken-c', 'Chicken liver, cooked', 'Куриная печень, приготовленная', 167, 24.5, 6.5, 0.9),
  F('ham', 'Ham', 'Ветчина', 145, 18, 7, 1.5),
  F('sausage-boiled', 'Boiled sausage (doktorskaya)', 'Колбаса варёная (докторская)', 257, 12.8, 22.2, 1.5),
  F('sausages', 'Frankfurters', 'Сосиски', 266, 11, 23.9, 1.6, U(50, '1 sausage', '1 шт')),
  F('salami', 'Smoked salami', 'Колбаса сырокопчёная', 420, 24, 36, 1),
  F('cutlet', 'Meat cutlet (kotleta)', 'Котлета мясная', 220, 15, 14, 8, U(80, '1 cutlet', '1 шт')),
  F('pelmeni', 'Pelmeni, boiled', 'Пельмени варёные', 245, 11, 12, 23),

  /* ---- fish and seafood ---- */
  F('salmon-c', 'Salmon, cooked', 'Лосось, приготовленный', 206, 22.1, 12.4, 0),
  F('salmon-salted', 'Salmon, lightly salted', 'Сёмга слабосолёная', 202, 22.5, 12.5, 0),
  F('cod-c', 'Cod, cooked', 'Треска, приготовленная', 105, 22.8, 0.9, 0),
  F('pollock-c', 'Pollock, cooked', 'Минтай, приготовленный', 92, 19.4, 1, 0),
  F('tuna-can', 'Tuna in own juice, canned', 'Тунец в собственном соку', 116, 25.5, 0.8, 0),
  F('herring', 'Herring, salted', 'Сельдь солёная', 217, 19.8, 15.4, 0),
  F('mackerel-smoked', 'Mackerel, smoked', 'Скумбрия копчёная', 262, 20.7, 19.9, 0),
  F('shrimp-c', 'Shrimp, cooked', 'Креветки варёные', 99, 24, 0.3, 0.2),
  F('crab-sticks', 'Crab sticks', 'Крабовые палочки', 88, 6, 1, 13),

  /* ---- eggs and dairy ---- */
  F('egg', 'Egg', 'Яйцо куриное', 143, 12.6, 9.5, 0.7, U(50, '1 egg', '1 яйцо')),
  F('egg-white', 'Egg white', 'Яичный белок', 52, 10.9, 0.2, 0.7, U(33, '1 white', '1 белок')),
  F('omelette', 'Omelette with milk', 'Омлет с молоком', 154, 9.6, 12, 1.9),
  F('milk-1', 'Milk 1%', 'Молоко 1%', 42, 3.4, 1, 5, U(250, '1 glass', '1 стакан')),
  F('milk-2.5', 'Milk 2.5%', 'Молоко 2,5%', 52, 2.8, 2.5, 4.7, U(250, '1 glass', '1 стакан')),
  F('milk-3.2', 'Milk 3.2%', 'Молоко 3,2%', 59, 2.9, 3.2, 4.7, U(250, '1 glass', '1 стакан')),
  F('kefir-1', 'Kefir 1%', 'Кефир 1%', 40, 3, 1, 4, U(250, '1 glass', '1 стакан')),
  F('kefir-2.5', 'Kefir 2.5%', 'Кефир 2,5%', 53, 2.9, 2.5, 4, U(250, '1 glass', '1 стакан')),
  F('ryazhenka', 'Ryazhenka 4%', 'Ряженка 4%', 67, 2.8, 4, 4.2, U(250, '1 glass', '1 стакан')),
  F('cottage-0', 'Cottage cheese 0%', 'Творог 0%', 71, 16.5, 0.2, 1.3),
  F('cottage-5', 'Cottage cheese 5%', 'Творог 5%', 121, 17.2, 5, 1.8),
  F('cottage-9', 'Cottage cheese 9%', 'Творог 9%', 159, 16.7, 9, 2),
  F('skyr', 'Skyr / high-protein yogurt', 'Скир / протеиновый йогурт', 63, 11, 0.2, 4),
  F('yogurt-greek-2', 'Greek yogurt 2%', 'Греческий йогурт 2%', 73, 9.9, 2, 3.9),
  F('yogurt-plain', 'Plain yogurt 2.5%', 'Йогурт натуральный 2,5%', 66, 4.1, 2.5, 6.7),
  F('sour-cream-15', 'Sour cream 15%', 'Сметана 15%', 162, 2.6, 15, 3, U(20, '1 tbsp', '1 ст. л.')),
  F('sour-cream-20', 'Sour cream 20%', 'Сметана 20%', 206, 2.5, 20, 3.4, U(20, '1 tbsp', '1 ст. л.')),
  F('cheese-hard', 'Hard cheese (gouda-type)', 'Сыр твёрдый (гауда)', 356, 25, 27.4, 2.2, U(20, '1 slice', '1 ломтик')),
  F('cheese-mozz', 'Mozzarella', 'Моцарелла', 280, 22, 21, 2.2),
  F('cheese-feta', 'Feta / brynza', 'Фета / брынза', 264, 14.2, 21.3, 4.1),
  F('syrniki', 'Syrniki (cottage cheese pancakes)', 'Сырники', 220, 13, 10, 19, U(60, '1 piece', '1 шт')),
  F('glazed-curd', 'Glazed curd bar', 'Сырок глазированный', 410, 8.5, 27, 32, U(40, '1 bar', '1 шт')),
  F('butter', 'Butter 82%', 'Масло сливочное 82%', 748, 0.5, 82.5, 0.8, U(10, '1 tsp', '1 ч. л.')),
  F('cream-10', 'Cream 10%', 'Сливки 10%', 118, 3, 10, 4),

  /* ---- protein products ---- */
  F('whey', 'Whey protein powder', 'Протеин сывороточный', 390, 75, 6, 8, U(30, '1 scoop', '1 мерная ложка')),
  F('casein', 'Casein protein powder', 'Протеин казеиновый', 370, 78, 2, 6, U(30, '1 scoop', '1 мерная ложка')),
  F('protein-bar', 'Protein bar', 'Протеиновый батончик', 350, 30, 10, 35, U(60, '1 bar', '1 шт')),
  F('tofu', 'Tofu', 'Тофу', 76, 8, 4.8, 1.9),

  /* ---- vegetables ---- */
  F('potato-boiled', 'Potato, boiled', 'Картофель варёный', 82, 2, 0.4, 16.7),
  F('potato-mashed', 'Mashed potatoes with milk', 'Картофельное пюре с молоком', 90, 2, 3.3, 13.5),
  F('potato-fried', 'Potato, fried', 'Картофель жареный', 192, 2.8, 9.5, 23.4),
  F('fries', 'French fries', 'Картофель фри', 312, 3.4, 15, 41),
  F('sweet-potato-b', 'Sweet potato, baked', 'Батат запечённый', 90, 2, 0.2, 20.7),
  F('cucumber', 'Cucumber', 'Огурец', 15, 0.8, 0.1, 2.8, U(100, '1 cucumber', '1 шт')),
  F('tomato', 'Tomato', 'Помидор', 18, 0.9, 0.2, 3.9, U(120, '1 tomato', '1 шт')),
  F('bell-pepper', 'Bell pepper', 'Перец болгарский', 26, 1, 0.3, 6, U(150, '1 pepper', '1 шт')),
  F('carrot', 'Carrot', 'Морковь', 41, 0.9, 0.2, 9.6, U(80, '1 carrot', '1 шт')),
  F('cabbage', 'White cabbage', 'Капуста белокочанная', 25, 1.3, 0.1, 5.8),
  F('sauerkraut', 'Sauerkraut', 'Квашеная капуста', 19, 0.9, 0.1, 4.3),
  F('broccoli', 'Broccoli', 'Брокколи', 34, 2.8, 0.4, 6.6),
  F('cauliflower', 'Cauliflower', 'Цветная капуста', 25, 1.9, 0.3, 5),
  F('zucchini', 'Zucchini', 'Кабачок', 17, 1.2, 0.3, 3.1),
  F('beetroot-b', 'Beetroot, boiled', 'Свёкла варёная', 44, 1.7, 0.2, 10),
  F('onion', 'Onion', 'Лук репчатый', 40, 1.1, 0.1, 9.3),
  F('mushrooms', 'Mushrooms (champignon)', 'Шампиньоны', 22, 3.1, 0.3, 3.3),
  F('spinach', 'Spinach', 'Шпинат', 23, 2.9, 0.4, 3.6),
  F('lettuce', 'Lettuce / salad leaves', 'Салат листовой', 15, 1.4, 0.2, 2.9),
  F('avocado', 'Avocado', 'Авокадо', 160, 2, 14.7, 8.5, U(140, '1 avocado (flesh)', '1 авокадо (мякоть)')),
  F('pickles', 'Pickled cucumber', 'Огурцы маринованные', 11, 0.5, 0.2, 2.3),
  F('veg-salad-oil', 'Vegetable salad with oil', 'Салат овощной с маслом', 80, 1, 6.5, 4.5),

  /* ---- fruit and berries ---- */
  F('banana', 'Banana', 'Банан', 89, 1.1, 0.3, 22.8, U(120, '1 banana (peeled)', '1 банан (без кожуры)')),
  F('apple', 'Apple', 'Яблоко', 52, 0.3, 0.2, 13.8, U(180, '1 apple', '1 яблоко')),
  F('pear', 'Pear', 'Груша', 57, 0.4, 0.1, 15.2, U(170, '1 pear', '1 груша')),
  F('orange', 'Orange', 'Апельсин', 47, 0.9, 0.1, 11.8, U(150, '1 orange (peeled)', '1 апельсин (очищенный)')),
  F('mandarin', 'Mandarin', 'Мандарин', 53, 0.8, 0.3, 13.3, U(75, '1 mandarin (peeled)', '1 мандарин (очищенный)')),
  F('grapes', 'Grapes', 'Виноград', 69, 0.7, 0.2, 18.1),
  F('kiwi', 'Kiwi', 'Киви', 61, 1.1, 0.5, 14.7, U(75, '1 kiwi', '1 киви')),
  F('blueberries', 'Blueberries', 'Голубика / черника', 57, 0.7, 0.3, 14.5),
  F('strawberries', 'Strawberries', 'Клубника', 32, 0.7, 0.3, 7.7),
  F('raspberries', 'Raspberries', 'Малина', 52, 1.2, 0.7, 11.9),
  F('watermelon', 'Watermelon', 'Арбуз', 30, 0.6, 0.2, 7.6),
  F('dates', 'Dates, dried', 'Финики сушёные', 282, 2.5, 0.4, 75, U(8, '1 date', '1 шт')),
  F('raisins', 'Raisins', 'Изюм', 299, 3.1, 0.5, 79.2),
  F('prunes', 'Prunes', 'Чернослив', 240, 2.2, 0.4, 63.9),
  F('dried-apricots', 'Dried apricots', 'Курага', 241, 3.4, 0.5, 62.6),

  /* ---- nuts, seeds, fats ---- */
  F('almonds', 'Almonds', 'Миндаль', 579, 21.2, 49.9, 21.6),
  F('walnuts', 'Walnuts', 'Грецкий орех', 654, 15.2, 65.2, 13.7),
  F('peanuts', 'Peanuts', 'Арахис', 567, 25.8, 49.2, 16.1),
  F('cashews', 'Cashews', 'Кешью', 553, 18.2, 43.9, 30.2),
  F('sunflower-seeds', 'Sunflower seeds', 'Семечки подсолнечника', 584, 20.8, 51.5, 20),
  F('peanut-butter', 'Peanut butter', 'Арахисовая паста', 588, 25, 50, 20, U(15, '1 tbsp', '1 ст. л.')),
  F('olive-oil', 'Olive oil', 'Масло оливковое', 884, 0, 100, 0, U(10, '1 tbsp', '1 ст. л.')),
  F('sunflower-oil', 'Sunflower oil', 'Масло подсолнечное', 884, 0, 100, 0, U(10, '1 tbsp', '1 ст. л.')),
  F('mayonnaise', 'Mayonnaise 67%', 'Майонез 67%', 627, 0.8, 67, 3.9, U(15, '1 tbsp', '1 ст. л.')),

  /* ---- sweets and snacks ---- */
  F('sugar', 'Sugar', 'Сахар', 398, 0, 0, 99.7, U(5, '1 tsp', '1 ч. л.')),
  F('honey', 'Honey', 'Мёд', 304, 0.3, 0, 82.4, U(12, '1 tsp', '1 ч. л.')),
  F('jam', 'Jam', 'Варенье / джем', 260, 0.4, 0.1, 64, U(15, '1 tbsp', '1 ст. л.')),
  F('choc-dark', 'Dark chocolate 70%', 'Шоколад горький 70%', 580, 7.8, 42, 36),
  F('choc-milk', 'Milk chocolate', 'Шоколад молочный', 535, 7.6, 29.7, 59.4),
  F('cookies', 'Biscuits / cookies', 'Печенье', 450, 7, 17, 68, U(10, '1 cookie', '1 шт')),
  F('ice-cream', 'Ice cream (plombir)', 'Мороженое пломбир', 230, 3.5, 15, 20),
  F('chips', 'Potato chips', 'Чипсы картофельные', 536, 7, 34.6, 52.9),
  F('granola', 'Granola', 'Гранола', 450, 10, 18, 62),
  F('cornflakes', 'Corn flakes', 'Кукурузные хлопья', 357, 7.5, 0.4, 84),
  F('pancakes', 'Pancakes (bliny)', 'Блины', 230, 6, 9, 31, U(50, '1 pancake', '1 блин')),

  /* ---- drinks ---- */
  F('juice-orange', 'Orange juice', 'Сок апельсиновый', 45, 0.7, 0.2, 10.4, U(250, '1 glass', '1 стакан')),
  F('cola', 'Cola', 'Кола', 42, 0, 0, 10.6, U(330, '1 can', '1 банка')),
  F('beer', 'Beer, lager', 'Пиво светлое', 43, 0.5, 0, 3.6, U(500, '0.5 l', '0,5 л')),
  F('wine-dry', 'Wine, dry', 'Вино сухое', 83, 0.1, 0, 2.6, U(150, '1 glass', '1 бокал')),
  F('latte', 'Latte (milk 2.5%)', 'Латте (молоко 2,5%)', 50, 2.6, 2, 4.2, U(300, '1 cup', '1 чашка')),
  F('cappuccino', 'Cappuccino (milk 2.5%)', 'Капучино (молоко 2,5%)', 40, 2.1, 1.6, 3.3, U(200, '1 cup', '1 чашка')),

  /* ---- prepared dishes ---- */
  F('borscht', 'Borscht', 'Борщ', 49, 1.5, 2.5, 5.4, U(300, '1 bowl', '1 тарелка')),
  F('chicken-soup', 'Chicken noodle soup', 'Куриный суп с лапшой', 45, 3, 1.5, 5, U(300, '1 bowl', '1 тарелка')),
  F('draniki', 'Potato pancakes (draniki)', 'Драники', 210, 4, 12, 22, U(70, '1 piece', '1 шт')),
  F('pilaf', 'Pilaf with meat', 'Плов с мясом', 180, 7, 7, 22),
  F('olivier', 'Olivier salad', 'Салат оливье', 198, 5.5, 16.5, 7.8),
  F('pizza', 'Pizza margherita', 'Пицца маргарита', 250, 10, 9, 32, U(110, '1 slice', '1 кусок')),
  F('shawarma', 'Shawarma (chicken)', 'Шаурма с курицей', 210, 11, 10, 19, U(350, '1 shawarma', '1 шт')),
  F('burger', 'Burger', 'Бургер', 250, 13, 11, 25, U(220, '1 burger', '1 шт')),
  F('sushi-roll', 'Sushi roll (California-type)', 'Роллы (типа «Калифорния»)', 175, 6, 5, 26, U(30, '1 piece', '1 шт')),
])

export const BASE_BY_ID = new Map(BASE_FOODS.map(f => [f.id, f]))

/** A built-in food's name in a language, English when that language has none. */
export const baseName = (f, lang) => (f?.n && (f.n[lang] || f.n.en)) || ''

/** A built-in food as the plain per-100 g shape the rest of nutrition.js uses. */
export const baseAsFood = (f, lang) => (f ? { id: f.id, name: baseName(f, lang), kcal: f.kcal, p: f.p, f: f.f, c: f.c, srv: f.u?.[0] || null } : null)
