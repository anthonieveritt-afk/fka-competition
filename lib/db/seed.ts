import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import {
  events, categories, athletes, registrations, matches, kumiteScores, competitionResults
} from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function seed() {
  console.log('🌱 Seeding database...');

  // Create event
  const [event] = await db.insert(events).values({
    name: 'FKA Spring Open 2026',
    date: '2026-06-14',
    location: 'Manchester Sports Centre',
    federation: 'FKA',
    status: 'registration',
  }).returning();
  console.log(`✅ Created event: ${event.name} (id: ${event.id})`);

  // Create categories
  const categoryData = [
    { name: 'Senior Male -75kg Kumite', discipline: 'kumite' as const, gender: 'male' as const, ageGroup: 'Senior', weightClass: '-75kg', beltRange: 'All grades' },
    { name: 'Senior Female Open Kumite', discipline: 'kumite' as const, gender: 'female' as const, ageGroup: 'Senior', weightClass: 'Open', beltRange: 'All grades' },
    { name: 'Junior Male Kata', discipline: 'kata' as const, gender: 'male' as const, ageGroup: 'Junior', weightClass: null, beltRange: 'All grades' },
    { name: 'Cadet Female Kata', discipline: 'kata' as const, gender: 'female' as const, ageGroup: 'Cadet', weightClass: null, beltRange: 'Kyu grades' },
    { name: 'Veteran Male +75kg Kumite', discipline: 'kumite' as const, gender: 'male' as const, ageGroup: 'Veteran', weightClass: '+75kg', beltRange: 'Dan grades' },
  ];

  const createdCategories = [];
  for (const cat of categoryData) {
    const [c] = await db.insert(categories).values({ eventId: event.id, ...cat }).returning();
    createdCategories.push(c);
  }
  console.log(`✅ Created ${createdCategories.length} categories`);

  // Create athletes
  const athleteData = [
    { firstName: 'James', surname: 'Mitchell', dateOfBirth: '1998-03-15', club: 'Shotokan Dojo Leeds', grade: '1st Dan', weight: 72, gender: 'male' },
    { firstName: 'Sarah', surname: 'Thompson', dateOfBirth: '2000-07-22', club: 'Wado-Ryu Manchester', grade: '2nd Dan', weight: 58, gender: 'female' },
    { firstName: 'Ryan', surname: 'Edwards', dateOfBirth: '1997-11-08', club: 'Frontier Karate York', grade: '1st Dan', weight: 74, gender: 'male' },
    { firstName: 'Emma', surname: 'Clarke', dateOfBirth: '2001-04-30', club: 'Shotokan Dojo Leeds', grade: '1st Kyu', weight: 55, gender: 'female' },
    { firstName: 'Daniel', surname: 'Harris', dateOfBirth: '1996-09-14', club: 'Kyokushin Sheffield', grade: '2nd Dan', weight: 78, gender: 'male' },
    { firstName: 'Sophie', surname: 'Wilson', dateOfBirth: '2002-01-25', club: 'Wado-Ryu Manchester', grade: '2nd Kyu', weight: 60, gender: 'female' },
    { firstName: 'Luke', surname: 'Robinson', dateOfBirth: '2007-06-18', club: 'Frontier Karate York', grade: '3rd Kyu', weight: 65, gender: 'male' },
    { firstName: 'Chloe', surname: 'Davies', dateOfBirth: '2008-02-14', club: 'Kyokushin Sheffield', grade: '4th Kyu', weight: null, gender: 'female' },
    { firstName: 'Tom', surname: 'Baker', dateOfBirth: '1980-12-03', club: 'Shotokan Dojo Leeds', grade: '3rd Dan', weight: 82, gender: 'male' },
    { firstName: 'Laura', surname: 'Foster', dateOfBirth: '1999-08-11', club: 'Frontier Karate York', grade: '1st Dan', weight: 62, gender: 'female' },
  ];

  const createdAthletes = [];
  for (const ath of athleteData) {
    const [a] = await db.insert(athletes).values({ ...ath, importedFrom: 'manual' }).returning();
    createdAthletes.push(a);
  }
  console.log(`✅ Created ${createdAthletes.length} athletes`);

  // Register athletes to categories
  const regs = [
    { athleteId: createdAthletes[0].id, categoryIdx: 0 }, // James -> Senior Male Kumite
    { athleteId: createdAthletes[2].id, categoryIdx: 0 }, // Ryan -> Senior Male Kumite
    { athleteId: createdAthletes[4].id, categoryIdx: 0 }, // Daniel -> Senior Male Kumite
    { athleteId: createdAthletes[1].id, categoryIdx: 1 }, // Sarah -> Senior Female Kumite
    { athleteId: createdAthletes[3].id, categoryIdx: 1 }, // Emma -> Senior Female Kumite
    { athleteId: createdAthletes[5].id, categoryIdx: 1 }, // Sophie -> Senior Female Kumite
    { athleteId: createdAthletes[6].id, categoryIdx: 2 }, // Luke -> Junior Male Kata
    { athleteId: createdAthletes[7].id, categoryIdx: 3 }, // Chloe -> Cadet Female Kata
    { athleteId: createdAthletes[8].id, categoryIdx: 4 }, // Tom -> Veteran Kumite
    { athleteId: createdAthletes[9].id, categoryIdx: 1 }, // Laura -> Senior Female Kumite
  ];

  for (const reg of regs) {
    await db.insert(registrations).values({
      athleteId: reg.athleteId,
      eventId: event.id,
      categoryId: createdCategories[reg.categoryIdx].id,
      status: 'confirmed',
    });
  }
  console.log(`✅ Created ${regs.length} registrations`);

  // Create some sample matches with tatami assignments
  const [match1] = await db.insert(matches).values({
    categoryId: createdCategories[0].id,
    eventId: event.id,
    roundType: 'semi',
    matchNumber: 1,
    redAthleteId: createdAthletes[0].id,
    blueAthleteId: createdAthletes[2].id,
    tatami: 1,
    status: 'scheduled',
  }).returning();

  const [match2] = await db.insert(matches).values({
    categoryId: createdCategories[0].id,
    eventId: event.id,
    roundType: 'final',
    matchNumber: 2,
    redAthleteId: createdAthletes[4].id,
    blueAthleteId: null,
    tatami: 1,
    status: 'scheduled',
  }).returning();

  const [match3] = await db.insert(matches).values({
    categoryId: createdCategories[1].id,
    eventId: event.id,
    roundType: 'pool',
    matchNumber: 3,
    redAthleteId: createdAthletes[1].id,
    blueAthleteId: createdAthletes[3].id,
    tatami: 2,
    status: 'scheduled',
  }).returning();

  console.log(`✅ Created 3 sample matches`);

  // Add some competition history
  const histories = [
    { athleteId: createdAthletes[0].id, eventName: 'FKA Winter Cup 2025', eventDate: '2025-12-07', categoryName: 'Senior Male -75kg Kumite', position: 1, medal: 'gold' as const },
    { athleteId: createdAthletes[1].id, eventName: 'FKA Winter Cup 2025', eventDate: '2025-12-07', categoryName: 'Senior Female Open Kumite', position: 2, medal: 'silver' as const },
    { athleteId: createdAthletes[2].id, eventName: 'FKA Winter Cup 2025', eventDate: '2025-12-07', categoryName: 'Senior Male -75kg Kumite', position: 3, medal: 'bronze' as const },
    { athleteId: createdAthletes[4].id, eventName: 'National Open 2025', eventDate: '2025-09-20', categoryName: 'Senior Male Open Kumite', position: 1, medal: 'gold' as const },
  ];

  for (const h of histories) {
    await db.insert(competitionResults).values({
      ...h,
      eventId: event.id,
    });
  }
  console.log(`✅ Created ${histories.length} competition results`);

  console.log('\n🎉 Seed complete!');
  console.log(`   Event ID: ${event.id}`);
  console.log(`   Categories: ${createdCategories.map(c => c.id).join(', ')}`);
  console.log(`   Athletes: ${createdAthletes.map(a => a.id).join(', ')}`);
  console.log(`   Matches: ${match1.id}, ${match2.id}, ${match3.id}`);
  console.log('\nSample URLs to test:');
  console.log(`   /admin/events/${event.id}`);
  console.log(`   /events/${event.id}/brackets/${createdCategories[0].id}`);
  console.log(`   /tatami/1`);
  console.log(`   /scoreboard/${match1.id}`);

  await pool.end();
}

seed().catch(e => {
  console.error('Seed failed:', e);
  pool.end();
  process.exit(1);
});
