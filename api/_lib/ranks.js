// Single source of truth for the rank ladder. Order matters — index 0 is
// where every roster entry starts (on Accept), and promote/demote just
// move up/down this list by one step. Edit this array to match your PD's
// actual rank structure; nothing else needs to change.
//
// Ordered lowest to highest.

const RANKS = [
  'TRAINEE',
  'OFFICER',
  'OFFICER FIRST CLASS',
  'OFFICER SECOND CLASS',
  'CORPORAL',
  'CORPORAL FIRST CLASS',
  'CORPORAL SECOND CLASS',
  'SERGEANT',
  'SERGEANT FIRST CLASS',
  'SERGEANT SECOND CLASS',
  'MASTER SERGEANT',
  'WATCH COMMANDER',
  'LIEUTENANT',
  'LIEUTENANT FIRST CLASS',
  'LIEUTENANT SECOND CLASS',
  'CAPTAIN',
  'COMMANDER',
  'DEPUTY CHIEF OF POLICE',
  'CHIEF OF POLICE',
  'DEPUTY POLICE COMMISIONER',
  'COMMISSIONER'
];

function isValidRank(rank) {
  return RANKS.includes(rank);
}

function nextRank(current) {
  const i = RANKS.indexOf(current);
  if (i === -1 || i === RANKS.length - 1) return current;
  return RANKS[i + 1];
}

function previousRank(current) {
  const i = RANKS.indexOf(current);
  if (i <= 0) return RANKS[0];
  return RANKS[i - 1];
}

module.exports = { RANKS, isValidRank, nextRank, previousRank };
