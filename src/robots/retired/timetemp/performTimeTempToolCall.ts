/**
 * Execute time and temperature tool calls
 * These are dummy functions that return random but realistic data for demonstration purposes
 */
export async function performTimeTempToolCall(
  toolName: string,
  toolArgs: any,
): Promise<any> {
  const { city } = toolArgs;

  if (!city || typeof city !== 'string') {
    throw new Error('City parameter is required and must be a string');
  }

  switch (toolName) {
    case 'getTime':
      return getTime(city);
    case 'getTemp':
      return getTemp(city);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Get a random but realistic time for a city
 */
function getTime(city: string): string {
  const hours = Math.floor(Math.random() * 24);
  const minutes = Math.floor(Math.random() * 60);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');

  return `The current time in ${city} is ${displayHours}:${displayMinutes} ${ampm}`;
}

/**
 * Get a random but realistic temperature for a city
 */
function getTemp(city: string): string {
  // Generate a temperature between -10 and 110 degrees Fahrenheit
  const temp = Math.floor(Math.random() * 120) - 10;
  const tempDescription = getTempDescription(temp);

  return `The current temperature in ${city} is ${temp}°F (${tempDescription})`;
}

/**
 * Get a description for the temperature
 */
function getTempDescription(temp: number): string {
  if (temp < 0) return 'very cold';
  if (temp < 32) return 'freezing';
  if (temp < 50) return 'cold';
  if (temp < 70) return 'cool';
  if (temp < 80) return 'mild';
  if (temp < 90) return 'warm';
  if (temp < 100) return 'hot';
  return 'very hot';
}
