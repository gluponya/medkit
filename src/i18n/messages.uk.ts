import type { Message } from './types.ts';

/**
 * The Ukrainian catalogue, the source of the interface text. Text is written
 * here first; English is a translation of it, and `MessageKey` comes from this
 * file, so a key that is not here does not exist.
 *
 * Copy rules (.superdesign/design-system.md): short, verbs in the infinitive on
 * buttons, never gendered.
 */
export const uk = {
  'app.name': 'Аптечка',
  'migrations.failed': 'Не вийшло відкрити дані на телефоні. Перезапустіть застосунок',

  'common.back': 'Назад',
  'common.later': 'Пізніше',

  'welcome.tagline': 'Знати, які ліки є вдома\nі до якого часу вони добрі',
  'welcome.local': 'Без реєстрації. Усе зберігається на телефоні.',
  'welcome.start': 'Почати',
  'welcome.invite': 'У мене є запрошення',
  'welcome.terms': 'Продовжуючи, ви приймаєте {terms} і {privacy}',
  'welcome.termsLink': 'Умови',
  'welcome.privacyLink': 'Політику конфіденційності',

  'place.title': 'Де ця аптечка?',
  'place.subtitle': 'Інші можна додати потім',
  'place.home': 'Дім',
  'place.car': 'Машина',
  'place.dacha': 'Дача',
  'place.parents': 'Батьки',
  'place.other': 'Інше',
  'place.withIntake': 'Терміни і нагадування про прийом',
  'place.expiryOnly': 'Тільки терміни',
  'place.name': 'Назва',
  'place.namePlaceholder': 'Наприклад, Робота',
  'place.icon': 'Іконка',
  'place.create': 'Створити аптечку',

  'tabs.cabinet': 'Аптечка',
  'tabs.today': 'Сьогодні',
  'tabs.shopping': 'Покупки',
  'tabs.settings': 'Налаштування',

  'home.search': 'Пошук',
  'home.add': 'Додати ліки',
  'home.switchCabinet': 'Змінити аптечку',
  'home.placeholder': 'Тут з’являться ваші ліки',
  'home.emptyTitle': 'Аптечка порожня',
  'home.emptyText': 'Додайте ліки, щоб стежити за терміном',
  'home.scan': 'Сканувати упаковку',
  'home.find': 'Знайти за назвою',

  'firstSteps.title': 'Перші кроки',
  'firstSteps.progress': '{done} з {total}',
  'firstSteps.medicines': 'Додати ліки, що є вдома',
  'firstSteps.medicinesHint': 'По одній упаковці, коли зручно',
  'firstSteps.medicinesDone': 'Додано {count}',
  'firstSteps.reminders': 'Налаштувати нагадування',
  'firstSteps.remindersHint': 'Для ліків, які п’єте щодня',
  'firstSteps.remindersDone': 'Нагадування є',
  'firstSteps.addReminder': 'Додати нагадування',
  'firstSteps.putOff': 'Відкладено. Можна повернутися',

  'soon.title': 'Скоро буде',
  'soon.text': 'Цей екран ще в роботі',
} satisfies Record<string, Message>;

export type MessageKey = keyof typeof uk;
