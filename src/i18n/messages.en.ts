import type { MessageKey } from './messages.uk.ts';
import type { Message } from './types.ts';

/** The English catalogue: a translation of messages.uk.ts, key for key. */
export const en: Record<MessageKey, Message> = {
  'app.name': 'Medkit',
  'migrations.failed': 'Could not open the data on this phone. Restart the app',

  'common.back': 'Back',
  'common.later': 'Later',

  'welcome.tagline': 'Know which medicines you have\nand how long they stay good',
  'welcome.local': 'No sign-up. Everything stays on your phone.',
  'welcome.start': 'Start',
  'welcome.invite': 'I have an invite',
  'welcome.terms': 'By continuing you accept the {terms} and {privacy}',
  'welcome.termsLink': 'Terms',
  'welcome.privacyLink': 'Privacy Policy',

  'place.title': 'Where is this kit?',
  'place.subtitle': 'You can add others later',
  'place.home': 'Home',
  'place.car': 'Car',
  'place.dacha': 'Country house',
  'place.parents': 'Parents',
  'place.other': 'Other',
  'place.withIntake': 'Expiry dates and intake reminders',
  'place.expiryOnly': 'Expiry dates only',
  'place.name': 'Name',
  'place.namePlaceholder': 'For example, Work',
  'place.icon': 'Icon',
  'place.create': 'Create kit',

  'tabs.cabinet': 'Medkit',
  'tabs.today': 'Today',
  'tabs.shopping': 'Shopping',
  'tabs.settings': 'Settings',

  'home.search': 'Search',
  'home.add': 'Add medicine',
  'home.switchCabinet': 'Switch kit',
  'home.placeholder': 'Your medicines will show up here',
  'home.emptyTitle': 'The kit is empty',
  'home.emptyText': 'Add medicines to keep an eye on their dates',
  'home.scan': 'Scan a pack',
  'home.find': 'Find by name',

  'firstSteps.title': 'First steps',
  'firstSteps.progress': '{done} of {total}',
  'firstSteps.medicines': 'Add the medicines you have',
  'firstSteps.medicinesHint': 'One pack at a time, when it suits you',
  'firstSteps.medicinesDone': '{count} added',
  'firstSteps.reminders': 'Set up reminders',
  'firstSteps.remindersHint': 'For medicines you take every day',
  'firstSteps.remindersDone': 'Reminders are set',
  'firstSteps.addReminder': 'Add a reminder',
  'firstSteps.putOff': 'Put off. You can come back',

  'soon.title': 'Coming soon',
  'soon.text': 'This screen is still being built',
};
