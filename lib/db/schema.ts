import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  real,
  json,
  pgEnum,
} from 'drizzle-orm/pg-core';

// Enums
export const eventStatusEnum = pgEnum('comp_event_status', ['draft', 'registration', 'live', 'completed']);
export const disciplineEnum = pgEnum('comp_discipline', ['kumite', 'kata']);
export const genderEnum = pgEnum('comp_gender', ['male', 'female', 'mixed']);
export const registrationStatusEnum = pgEnum('comp_registration_status', ['pending', 'confirmed', 'withdrawn']);
export const roundTypeEnum = pgEnum('comp_round_type', ['pool', 'elimination', 'repechage', 'final', 'semi', 'bronze']);
export const matchStatusEnum = pgEnum('comp_match_status', ['scheduled', 'live', 'complete']);
export const importedFromEnum = pgEnum('comp_imported_from', ['csv', 'manual']);
export const medalEnum = pgEnum('comp_medal', ['gold', 'silver', 'bronze']);

// Events
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  date: text('date').notNull(),
  location: text('location').notNull(),
  federation: text('federation').default('FKA').notNull(),
  status: eventStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Categories
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').references(() => events.id).notNull(),
  name: text('name').notNull(),
  discipline: disciplineEnum('discipline').notNull(),
  gender: genderEnum('gender').notNull(),
  ageGroup: text('age_group').notNull(),
  weightClass: text('weight_class'),
  beltRange: text('belt_range').notNull(),
});

// Athletes
export const athletes = pgTable('athletes', {
  id: serial('id').primaryKey(),
  firstName: text('first_name').notNull(),
  surname: text('surname').notNull(),
  dateOfBirth: text('date_of_birth').notNull(),
  club: text('club').notNull(),
  grade: text('grade').notNull(),
  weight: real('weight'),
  gender: text('gender').notNull(),
  email: text('email'),
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  importedFrom: importedFromEnum('imported_from').default('manual').notNull(),
});

// Registrations
export const registrations = pgTable('registrations', {
  id: serial('id').primaryKey(),
  athleteId: integer('athlete_id').references(() => athletes.id).notNull(),
  eventId: integer('event_id').references(() => events.id).notNull(),
  categoryId: integer('category_id').references(() => categories.id).notNull(),
  status: registrationStatusEnum('status').default('pending').notNull(),
  registeredAt: timestamp('registered_at').defaultNow().notNull(),
});

// Matches
export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id).notNull(),
  eventId: integer('event_id').references(() => events.id).notNull(),
  roundType: roundTypeEnum('round_type').notNull(),
  matchNumber: integer('match_number').notNull(),
  redAthleteId: integer('red_athlete_id').references(() => athletes.id),
  blueAthleteId: integer('blue_athlete_id').references(() => athletes.id),
  tatami: integer('tatami'),
  status: matchStatusEnum('status').default('scheduled').notNull(),
  scheduledAt: timestamp('scheduled_at'),
  winnerId: integer('winner_id').references(() => athletes.id),
  method: text('method'),
});

// Kumite Scores
export const kumiteScores = pgTable('kumite_scores', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').references(() => matches.id).notNull(),
  redYuko: integer('red_yuko').default(0).notNull(),
  redWazaari: integer('red_waza_ari').default(0).notNull(),
  redIppon: integer('red_ippon').default(0).notNull(),
  redPenalties: json('red_penalties').default([]).notNull(),
  blueYuko: integer('blue_yuko').default(0).notNull(),
  blueWazaari: integer('blue_waza_ari').default(0).notNull(),
  blueIppon: integer('blue_ippon').default(0).notNull(),
  bluePenalties: json('blue_penalties').default([]).notNull(),
  redTotal: integer('red_total').default(0).notNull(),
  blueTotal: integer('blue_total').default(0).notNull(),
  duration: integer('duration').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Kata Scores
export const kataScores = pgTable('kata_scores', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').references(() => matches.id).notNull(),
  athleteId: integer('athlete_id').references(() => athletes.id).notNull(),
  judge1: real('judge1'),
  judge2: real('judge2'),
  judge3: real('judge3'),
  judge4: real('judge4'),
  judge5: real('judge5'),
  technicalScore: real('technical_score'),
  athleticScore: real('athletic_score'),
  deduction: real('deduction').default(0),
  finalScore: real('final_score'),
  round: integer('round').default(1),
});

// Competition Results
export const competitionResults = pgTable('competition_results', {
  id: serial('id').primaryKey(),
  athleteId: integer('athlete_id').references(() => athletes.id).notNull(),
  eventId: integer('event_id').references(() => events.id),
  eventName: text('event_name').notNull(),
  eventDate: text('event_date').notNull(),
  categoryName: text('category_name').notNull(),
  position: integer('position').notNull(),
  medal: medalEnum('medal'),
  notes: text('notes'),
});
