import journal from './meta/_journal.json';
import m0000 from './0000_init.sql';
import m0001 from './0001_categories_and_register.sql';
import m0002 from './0002_reminders_and_intakes.sql';
import m0003 from './0003_shopping_items.sql';
import m0004 from './0004_shopping_dismissed.sql';
import m0005 from './0005_packages_expiry_unknown.sql';
import m0006 from './0006_cabinets_expiry_push.sql';
import m0007 from './0007_sync_tables.sql';
import m0008 from './0008_sync_triggers.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
m0007,
m0008
    }
  }
  