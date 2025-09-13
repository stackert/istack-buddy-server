// Debug script to see what dates we're actually sending to Sumo Logic

const startDate = "2025-08-17 06:15:00";
const endDate = "2025-08-17 08:15:00";

console.log('=== TIMEZONE DEBUG ===');
console.log('');

// What you provided
console.log('Input dates:');
console.log(`  Start: ${startDate}`);
console.log(`  End: ${endDate}`);
console.log('');

// How JavaScript interprets it (in your local timezone)
const startJs = new Date(startDate);
const endJs = new Date(endDate);

console.log('JavaScript Date objects (your local timezone):');
console.log(`  Start: ${startJs.toString()}`);
console.log(`  End: ${endJs.toString()}`);
console.log(`  Your timezone: ${startJs.getTimezoneOffset() / -60} hours from UTC`);
console.log('');

// What we send to Sumo Logic (epoch milliseconds)
const startEpoch = startJs.getTime();
const endEpoch = endJs.getTime();

console.log('Epoch milliseconds sent to Sumo Logic:');
console.log(`  Start: ${startEpoch} (${new Date(startEpoch).toISOString()})`);
console.log(`  End: ${endEpoch} (${new Date(endEpoch).toISOString()})`);
console.log('');

// How Sumo Logic interprets it with timeZone: 'America/New_York'
const nyOffset = -4; // EDT is UTC-4 in summer
const startNY = new Date(startEpoch);
const endNY = new Date(endEpoch);

console.log('How Sumo Logic sees it with timeZone="America/New_York":');
console.log(`  Start: ${startNY.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
console.log(`  End: ${endNY.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
console.log('');

// Suggestions
console.log('SOLUTIONS:');
console.log('1. Specify your input times in America/New_York timezone');
console.log('2. Remove timeZone parameter and let Sumo Logic use default');
console.log('3. Make timezone configurable in the script');
console.log('');

// What timezone are you actually in?
console.log('Your current system timezone info:');
console.log(`  ${new Date().toString()}`);
console.log(`  Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
