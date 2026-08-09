const commonLocations = Object.freeze([
  'Atlanta, GA',
  'Austin, TX',
  'Boston, MA',
  'Charlotte, NC',
  'Chicago, IL',
  'Dallas, TX',
  'Denver, CO',
  'Detroit, MI',
  'Houston, TX',
  'Los Angeles, CA',
  'Miami, FL',
  'Minneapolis, MN',
  'New York, NY',
  'Philadelphia, PA',
  'Phoenix, AZ',
  'Portland, OR',
  'Raleigh, NC',
  'San Diego, CA',
  'San Francisco, CA',
  'Seattle, WA',
  'Washington, DC'
]);

export function locationOptions(positions = []) {
  return [...new Set([
    ...positions.map((position) => position.location).filter(Boolean),
    ...commonLocations
  ])];
}
