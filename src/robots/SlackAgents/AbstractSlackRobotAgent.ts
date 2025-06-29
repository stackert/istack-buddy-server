import { AbstractRobot } from '../AbstractRobot';
import type { TSlackAgentFunctionDescription, TKnowledgeBase } from './types';

/**
 * Abstract agent robot class that extends the base robot functionality
 * with autonomous agent capabilities
 */
abstract class AbstractSlackRobotAgent extends AbstractRobot {
  abstract knowledgeBase: TKnowledgeBase;
  abstract getFunctionDescriptions(): TSlackAgentFunctionDescription[];
  // this will have acknowledge response - immediate
  // it will have follow up response - delayed - I guess it will have to 'emit' that, or call a callback?
  // File Upload Robot as example - 'received your request' after some long task 'file uploaded your link is..'
}

export { AbstractSlackRobotAgent };
`
do we build sumo robot? or is that functionality reserved for the channel robot.

Next we need build two robots #forms-sso-autofill and #cx-formstack.  These are the two robots that will be used to build the channel robot.

`;
