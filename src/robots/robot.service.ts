import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AbstractRobot } from './AbstractRobot';
import { ChatRobotParrot } from './ChatRobotParrot';
import { AgentRobotParrot } from './AgentRobotParrot';
import { RobotChatOpenAI } from './RobotChatOpenAI';
// import { RobotChatAnthropic } from './RobotChatAnthropic.ts.hidden';
// import { PseudoRobotRouter } from './PseudoRobotRouter.ts.hidden';
// import { PseudoRobotRouterSuggestions } from './PseudoRobotRouterSuggestions.ts.hidden';
// import { PseudoRobotDocumentationSuggestions } from './PseudoRobotDocumentationSuggestions.ts.hidden';
import { SlackAgentCoreFormsParrot } from './SlackAgents/SlackAgentCoreFormsParrot';
import { SlackAgentCoreFormsSsoAutofillParrot } from './SlackAgents/SlackAgentCoreFormsSsoAutofillParrot';

@Injectable()
export class RobotService implements OnModuleInit {
  private readonly logger = new Logger(RobotService.name);
  private readonly robots: Map<string, AbstractRobot> = new Map();

  async onModuleInit() {
    this.initializeRobots();
    this.logger.log(`Initialized ${this.robots.size} robots`);
  }

  /**
   * Initialize all available robots
   */
  private initializeRobots(): void {
    const robotInstances: AbstractRobot[] = [
      new ChatRobotParrot(),
      new AgentRobotParrot(),
      new RobotChatOpenAI(),
      // new RobotChatAnthropic(),
      // new PseudoRobotRouter(),
      // new PseudoRobotRouterSuggestions(),
      // new PseudoRobotDocumentationSuggestions(),
      new SlackAgentCoreFormsParrot(),
      new SlackAgentCoreFormsSsoAutofillParrot(),
    ];

    robotInstances.forEach((robot) => {
      this.robots.set(robot.name, robot);
      this.logger.debug(
        `Registered robot: ${robot.name} v${robot.getVersion()}`,
      );
    });
  }

  /**
   * Get a robot by its name
   * @param name The name of the robot to retrieve
   * @returns The robot instance or undefined if not found
   */
  getRobotByName<R extends AbstractRobot>(name: string): R | undefined {
    return this.robots.get(name) as R;
  }

  /**
   * Get all available robot names
   * @returns Array of robot names
   */
  getAvailableRobotNames(): string[] {
    return Array.from(this.robots.keys());
  }

  /**
   * Get all robot instances
   * @returns Array of robot instances
   */
  getAllRobots(): AbstractRobot[] {
    return Array.from(this.robots.values());
  }

  /**
   * Check if a robot exists by name
   * @param name The name of the robot to check
   * @returns True if robot exists, false otherwise
   */
  hasRobot(name: string): boolean {
    return this.robots.has(name);
  }

  /**
   * Get robots by type (class name)
   * @param robotClass The class name to filter by
   * @returns Array of robots matching the class
   */
  getRobotsByClass(robotClass: string): AbstractRobot[] {
    return Array.from(this.robots.values()).filter(
      (robot) => robot.robotClass === robotClass,
    );
  }

  /**
   * Register a new robot instance
   * @param robot The robot instance to register
   * @param overwrite Whether to overwrite existing robot with same name
   * @throws Error if robot name already exists and overwrite is false
   */
  registerRobot(robot: AbstractRobot, overwrite: boolean = false): void {
    if (this.robots.has(robot.name) && !overwrite) {
      throw new Error(`Robot with name '${robot.name}' already exists`);
    }

    this.robots.set(robot.name, robot);
    this.logger.log(
      `${overwrite ? 'Updated' : 'Registered'} robot: ${robot.name}`,
    );
  }

  /**
   * Unregister a robot by name
   * @param name The name of the robot to unregister
   * @returns True if robot was removed, false if not found
   */
  unregisterRobot(name: string): boolean {
    const removed = this.robots.delete(name);
    if (removed) {
      this.logger.log(`Unregistered robot: ${name}`);
    }
    return removed;
  }
}
