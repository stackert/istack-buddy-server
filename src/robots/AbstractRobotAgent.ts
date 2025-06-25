import { AbstractRobot } from './AbstractRobot';
import type { TMessageEnvelope } from './types';

/**
 * Abstract agent robot class that extends the base robot functionality
 * with autonomous agent capabilities
 */
export abstract class AbstractRobotAgent extends AbstractRobot {
  // this will have acknowledge response - immediate
  // it will have follow up response - delayed - I guess it will have to 'emit' that, or call a callback?
  // File Upload Robot as example - 'received your request' after some long task 'file uploaded your link is..'
}
