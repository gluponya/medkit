// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_init.sql';
import m0001 from './0001_categories_and_register.sql';
import m0002 from './0002_reminders_and_intakes.sql';
import m0003 from './0003_shopping_items.sql';
import m0004 from './0004_shopping_dismissed.sql';
import m0005 from './0005_packages_expiry_unknown.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005
    }
  }
  