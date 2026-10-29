import { type SubstanceFacts } from './body-time';

/**
 * Per substance: half-life and the instruction's words about alcohol
 * (docs/model.md, "SubstanceFacts"). Read from one Register instruction per
 * INN, by two reviewers apart; a row ships once they agree and the quotes are
 * found in the instruction word for word. A mean with a range around it is the
 * mean: the range is the spread between people. Left out until their
 * instruction gives a number: Amoxicillin and beta-lactamase inhibitor, Cefixime, Clarithromycin, Metamizole sodium, Oseltamivir.
 */
export const SUBSTANCE_FACTS: readonly SubstanceFacts[] = [
  {
    inn: 'Acetylcysteine',
    halfLifeHours: { min: 6.25, max: 6.25 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/1288FEFE077F9B8B42258B9500605955/$file/UA142700101_2271.mht',
    reviewed: true,
  },
  {
    inn: 'Acetylsalicylic acid',
    halfLifeHours: { min: 2, max: 3 },
    alcohol: 'caution',
    alcoholQuote:
      'Алкоголь сприяє пошкодженню слизової оболонки шлунково-кишкового тракту і пролонгує час кровотечі внаслідок синергізму ацетилсаліцилової кислоти та алкоголю.',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/66188667FB575F1B42258E3C0034738D/$file/UA56870102_45E9.mht',
    reviewed: true,
  },
  {
    inn: 'Ambroxol',
    halfLifeHours: { min: 10, max: 10 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/76C2D13D9A5BCFEC42258D4F003047CD/$file/UA99280101_874E.mht',
    reviewed: true,
  },
  {
    inn: 'Amlodipine',
    halfLifeHours: { min: 35, max: 50 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/5A4ABE90CE9FF0B542258DA1004C1FA3/$file/UA113140102_A468.mht',
    reviewed: true,
  },
  {
    inn: 'Amoxicillin',
    halfLifeHours: { min: 1, max: 1.5 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/4E43B01EC262588642258C42003EB1D3/$file/UA10810101_AC84.mht',
    reviewed: true,
  },
  {
    inn: 'Atorvastatin',
    halfLifeHours: { min: 14, max: 14 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/24E2C87D6AC1F43C42258D8E003A7683/$file/UA185740101_D181.mht',
    reviewed: true,
  },
  {
    inn: 'Azithromycin',
    halfLifeHours: { min: 48, max: 96 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/A9869A5A676A44B142258E0D00424CA3/$file/UA58110101_F8C3.mht',
    reviewed: true,
  },
  {
    inn: 'Bisoprolol',
    halfLifeHours: { min: 10, max: 12 },
    alcohol: 'caution',
    alcoholQuote:
      'Ефект препарату може посилюватись при одночасному застосуванні з алкоголем.',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/B1B05E7A3FD69C6142258917002FE4C3/$file/UA38000102_6A0C.mht',
    reviewed: true,
  },
  {
    inn: 'Cefuroxime',
    halfLifeHours: { min: 1, max: 1.5 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/64C1DE08B0A1A65D42258E48004771B1/$file/UA87140201_A833.mht',
    reviewed: true,
  },
  {
    inn: 'Cetirizine',
    halfLifeHours: { min: 10, max: 10 },
    alcohol: 'avoid',
    alcoholQuote:
      'При прийомі у терапевтичних дозах не спостерігалося клінічно значущих взаємодій з алкоголем (при рівнях алкоголю у крові 0,5 г/л), проте рекомендовано уникати одночасного вживання алкоголю.',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/40DAA1C48BEEAE1842258CEB003BD428/$file/UA64220201_D190.mht',
    reviewed: true,
  },
  {
    inn: 'Ciprofloxacin',
    halfLifeHours: { min: 4, max: 7 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/A1A3FF27342D563642258D080030C2BB/$file/UA129820102_483E.mht',
    reviewed: true,
  },
  {
    inn: 'Desloratadine',
    halfLifeHours: { min: 27, max: 27 },
    alcohol: 'caution',
    alcoholQuote:
      'Тому необхідно бути обережними при одночасному застосуванні алкоголю у період лікування дезлоратадином.',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/0DF36BD666B1279642258BAF0036956A/$file/UA171790101_ED4C.mht',
    reviewed: true,
  },
  {
    inn: 'Dexketoprofen',
    halfLifeHours: { min: 1.65, max: 1.65 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/D57912C5ABB668F942258D7700485774/$file/UA138050101_A04E.mht',
    reviewed: true,
  },
  {
    inn: 'Diazepam',
    halfLifeHours: { min: 24, max: 48 },
    metaboliteHalfLifeHours: { min: 60, max: 60 },
    alcohol: 'forbidden',
    alcoholWaitHours: 72,
    alcoholQuote:
      'Під час лікування діазепамом і ще 3 дні потому не можна вживати ніяких спиртних напоїв.',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/A0659809238FEE3D42258BFC0029C9A7/$file/UA105350101_4BEF.mht',
    reviewed: true,
  },
  {
    inn: 'Diclofenac',
    halfLifeHours: { min: 1, max: 2 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/19190A553FF8646F42258DA1004D732B/$file/UA03100401_4C61.mht',
    reviewed: true,
  },
  {
    inn: 'Domperidone',
    halfLifeHours: { min: 7, max: 9 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/E3C2BEE9C1E3029442258DA1004C9B37/$file/UA24670101_39B3.mht',
    reviewed: true,
  },
  {
    inn: 'Doxylamine',
    halfLifeHours: { min: 10, max: 13 },
    alcohol: 'forbidden',
    alcoholQuote:
      'Під час лікування доксиламіном не слід вживати алкоголь, оскільки він може непередбачуваним чином посилювати дію доксиламіну.',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/93B1C688AC68B13542258E2C0034CA3B/$file/UA213470101_AC26.mht',
    reviewed: true,
  },
  {
    inn: 'Drotaverine',
    halfLifeHours: { min: 8, max: 10 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/73E1CBFFCB290508C2258D91006CE423/$file/UA103440101_EE51.mht',
    reviewed: true,
  },
  {
    inn: 'Escitalopram',
    halfLifeHours: { min: 30, max: 30 },
    alcohol: 'avoid',
    alcoholQuote:
      'Однак, як і у разі застосування психотропних лікарських засобів, комбінація з алкоголем є небажаною.',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/E3865BDB65E29DC742258CC2002CBD8D/$file/UA116610101_2615.mht',
    reviewed: true,
  },
  {
    inn: 'Fexofenadine',
    halfLifeHours: { min: 11, max: 15 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/79DB9E9263A79CD6C2258DBD0040684E/$file/UA85000101_D3BD.mht',
    reviewed: true,
  },
  {
    inn: 'Fluconazole',
    halfLifeHours: { min: 30, max: 30 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/CB975E5FFDE6D35B42258CAF004218B7/$file/UA02760102_607F.mht',
    reviewed: true,
  },
  {
    inn: 'Fosfomycin',
    halfLifeHours: { min: 4, max: 4 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/6B31580C520309EA42258C7B003AFF1C/$file/UA201950101_475D.mht',
    reviewed: true,
  },
  {
    inn: 'Ibuprofen',
    halfLifeHours: { min: 2, max: 2 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/3C8F30701F37D15942258E0D00427D6D/$file/UA60450101_6DE8.mht',
    reviewed: true,
  },
  {
    inn: 'Ketorolac',
    halfLifeHours: { min: 4, max: 6 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/08679AC38A4EB28542258E4C0037AFCD/$file/UA195630101_EB6B.mht',
    reviewed: true,
  },
  {
    inn: 'Levocetirizine',
    halfLifeHours: { min: 7.9, max: 7.9 },
    alcohol: 'avoid',
    alcoholQuote:
      'Під час терапії левоцетиризином слід уникати вживання алкоголю (див. розділ «Взаємодія з іншими лікарськими засобами та інші види взаємодій»).',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/7ECCFB5034443FE442258E3C00351F0C/$file/UA86120101_4EF3.mht',
    reviewed: true,
  },
  {
    inn: 'Levofloxacin',
    halfLifeHours: { min: 6, max: 8 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/82205282AB8861E142258D3F00516320/$file/UA109580101_0E7B.mht',
    reviewed: true,
  },
  {
    inn: 'Loperamide',
    halfLifeHours: { min: 11, max: 11 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/38A4246C2A1CF75FC2258D310056C39B/$file/UA98310201_CEBC.mht',
    reviewed: true,
  },
  {
    inn: 'Loratadine',
    halfLifeHours: { min: 8.4, max: 8.4 },
    metaboliteHalfLifeHours: { min: 28, max: 28 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/6DF30741058A807C42258A5C0026F565/$file/UA75600101_A9DC.mht',
    reviewed: true,
  },
  {
    inn: 'Meloxicam',
    halfLifeHours: { min: 20, max: 20 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/BB26AE55BFC02D4942258E05004838A8/$file/UA167410101_E782.mht',
    reviewed: true,
  },
  {
    inn: 'Metformin',
    halfLifeHours: { min: 6.5, max: 6.5 },
    alcohol: 'avoid',
    alcoholQuote:
      'Алкогольна інтоксикація асоціюється з підвищеним ризиком лактоацидозу, особливо при голодуванні, недоїданні або печінковій недостатності.',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/7EEE9A1590128ED042258DB1006BCA44/$file/UA146310102_44CD.mht',
    reviewed: true,
  },
  {
    inn: 'Metronidazole',
    halfLifeHours: { min: 8, max: 8 },
    alcohol: 'forbidden',
    alcoholWaitHours: 72,
    alcoholQuote:
      'Пацієнтам не слід приймати алкоголь під час лікування метронідазолом та протягом щонайменше 3 днів після прийому у зв’язку з можливістю ефекту антабусу.',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/A8A359459E27930A42258C270032BC3D/$file/UA09280101_19DF.mht',
    reviewed: true,
  },
  {
    inn: 'Naproxen',
    halfLifeHours: { min: 12, max: 15 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/38797EA697FAE12342258D8E0038D77F/$file/UA89380101_9EFC.mht',
    reviewed: true,
  },
  {
    inn: 'Nimesulide',
    halfLifeHours: { min: 3.2, max: 6 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/43C7863CB6B288E442258E5E00457BB3/$file/UA87150101_E86C.mht',
    reviewed: true,
  },
  {
    inn: 'Omeprazole',
    halfLifeHours: { min: 1, max: 1 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/49065962241191EA42258DCD004671A7/$file/UA02350202_F249.mht',
    reviewed: true,
  },
  {
    inn: 'Pantoprazole',
    halfLifeHours: { min: 1, max: 1 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/59D9E5118CC99AAD42258DF6004EFABC/$file/UA175880101_FA95.mht',
    reviewed: true,
  },
  {
    inn: 'Paracetamol',
    halfLifeHours: { min: 2, max: 3 },
    alcohol: 'forbidden',
    alcoholQuote:
      'Під час лікування парацетамолом не можна вживати алкогольні напої.',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/20EC2A683B1016A042258D08002FBF03/$file/UA204800102_A2E1.mht',
    reviewed: true,
  },
  {
    inn: 'Pregabalin',
    halfLifeHours: { min: 6.3, max: 6.3 },
    alcohol: 'caution',
    alcoholQuote:
      'Прегабалін може потенціювати ефекти етанолу та лоразепаму.',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/1467104DCBCFF705C2258C11002978FC/$file/UA191010102_4373.mht',
    reviewed: true,
  },
  {
    inn: 'Rosuvastatin',
    halfLifeHours: { min: 19, max: 19 },
    alcohol: 'not_mentioned',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/2777D4A9FCA7348342258E5E004731FB/$file/UA160750102_FEAB.mht',
    reviewed: true,
  },
  {
    inn: 'Sertraline',
    halfLifeHours: { min: 26, max: 26 },
    alcohol: 'avoid',
    alcoholQuote:
      'Одночасне застосування сертраліну у дозі 200 мг на добу не потенціювало ефекти алкоголю, карбамазепіну, галоперидолу чи фенітоїну щодо когнітивних та психомоторних функцій у здорових добровольців, однак одночасне застосування сертраліну з алкоголем не рекомендується.',
    source: 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/67CA4E5E8076456B42258D6A0032C212/$file/UA87700102_4BCD.mht',
    reviewed: true,
  },
];
