// Run the daily billing job from the command line (e.g. from cron).
import "dotenv/config";
import { db } from "../src/lib/db";
import { runBilling } from "../src/server/billing";

runBilling()
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
    return db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
