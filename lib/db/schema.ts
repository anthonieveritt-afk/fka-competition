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
export const disciplineEnum = pgEnum('comp_discipline', ['kumite', 'kata', 'slam_man']);
export const genderEnum = pgEnum('comp_gender', ['male', 'female', 'mixed']);
export const registrationStatusEnum = pgEnum('comp_registration_status', ['pending', 'confirmed', 'withdrawn']);
export const roundTypeEnum = pgEnum('comp_round_type', ['pool', 'elimination', 'repechage', 'final', 'semi', 'bronze']);
export const matchStatusEnum = pgEnum('comp_match_status', ['scheduled', 'live', 'complete']);
export const importedFromEnum = pgEnum('comp_imported_from', ['csv', 'manual']);
export const medalEnum = pgEnum('comp_medal', ['gold', 'silver', 'bronze']);

// Events
export const events = pgTable('comp_events', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  date: text('date').notNull(),
  location: text('location').notNull(),
  federation: text('federation').default('FKA').notNull(),
  status: eventStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Categories
export const categories = pgTable('comp_categories', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').references(() => events.id).notNull(),
  name: text('name').notNull(),
  discipline: text('discipline').notNull(),
  gender: text('gender').notNull(),
  ageGroup: text('age_group').notNull(),
  weightClass: text('weight_class'),
  beltRange: text('belt_range'),
});

// Athletes
export const athletes = pgTable('comp_athletes', {
  id: serial('id').primaryKey(),
  firstName: text('first_name').notNull(),
  surname: text('surname').notNull(),
  dateOfBirth: text('date_of_birth'),
  club: text('club').notNull(),
  grade: text('grade'),
  weight: real('weight'),
  heightCm: real('height_cm'),
  gender: text('gender'),
  email: text('email'),
  phone: text('phone'),
  ekfLicence: text('ekf_licence'),
  licenceExpiry: text('licence_expiry'),
  emergencyContact: text('emergency_contact'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  importedFrom: text('imported_from').default('manual').notNull(),
});

// Registrations
export const registrations = pgTable('comp_registrations', {
  id: serial('id').primaryKey(),
  athleteId: integer('athlete_id').references(() => athletes.id).notNull(),
  eventId: integer('event_id').references(() => events.id).notNull(),
  categoryId: integer('category_id').references(() => categories.id).notNull(),
  status: text('status').default('pending').notNull(),
  registeredAt: timestamp('registered_at').defaultNow().notNull(),
});

// Matches
export const matches = pgTable('comp_matches', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id).notNull(),
  eventId: integer('event_id').references(() => events.id).notNull(),
  roundType: text('round_type').notNull(),
  matchNumber: integer('match_number').notNull(),
  redAthleteId: integer('red_athlete_id').references(() => athletes.id),
  blueAthleteId: integer('blue_athlete_id').references(() => athletes.id),
  tatami: integer('tatami').default(1),
  status: text('status').default('scheduled').notNull(),
  scheduledAt: timestamp('scheduled_at'),
  winnerId: integer('winner_id').references(() => athletes.id),
  method: text('method'),
});

// Kumite Scores
export const kumiteScores = pgTable('comp_kumite_scores', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').references(() => matches.id).notNull(),
  redYuko: integer('red_yuko').default(0),
  redWazaari: integer('red_wazaari').default(0),
  redIppon: integer('red_ippon').default(0),
  redPenalties: json('red_penalties').default([]),
  blueYuko: integer('blue_yuko').default(0),
  blueWazaari: integer('blue_wazaari').default(0),
  blueIppon: integer('blue_ippon').default(0),
  bluePenalties: json('blue_penalties').default([]),
  redTotal: integer('red_total').default(0),
  blueTotal: integer('blue_total').default(0),
  duration: integer('duration').default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Competition Results (historical)
export const competitionResults = pgTable('comp_competition_results', {
  id: serial('id').primaryKey(),
  athleteId: integer('athlete_id').references(() => athletes.id).notNull(),
  eventId: integer('event_id'),
  eventName: text('event_name').notNull(),
  eventDate: text('event_date').notNull(),
  categoryName: text('category_name').notNull(),
  position: integer('position'),
  medal: text('medal'),
  notes: text('notes'),
});
