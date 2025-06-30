import { Injectable } from '@nestjs/common';
import { RobotService } from './robot.service';
import { AbstractRobot } from './AbstractRobot';
import type { TMessageEnvelope } from './types';

/**
 * Example service demonstrating how to use the injectable RobotService
 */
@Injectable()
export class ExampleClientService {
  constructor(private readonly robotService: RobotService) {}

  /**
   * Example: Get a specific robot by name and send a message
   */
  async sendMessageToRobot(
    robotName: string,
    message: string,
  ): Promise<TMessageEnvelope | null> {
    // Get robot by name using the injectable service
    const robot = this.robotService.getRobotByName(robotName);

    if (!robot) {
      console.log(`Robot '${robotName}' not found`);
      return null;
    }

    // Create a message envelope
    const messageEnvelope: TMessageEnvelope = {
      routerId: 'example-client',
      messageType: 'message',
      message: {
        message,
        sender: 'user',
        timestamp: new Date().toISOString(),
      },
    };

    // Send message and get response (assuming it's a chat robot)
    try {
      const response = await robot.acceptMessageMultiPartResponse(
        messageEnvelope,
        (delayedResponse) => {
          console.log('Received delayed response:', delayedResponse);
        },
      );

      return response;
    } catch (error) {
      console.error('Error sending message to robot:', error);
      return null;
    }
  }

  /**
   * Example: List all available robots
   */
  listAvailableRobots(): string[] {
    return this.robotService.getAvailableRobotNames();
  }

  /**
   * Example: Get robot information
   */
  getRobotInfo(
    robotName: string,
  ): { name: string; version: string; class: string } | null {
    const robot = this.robotService.getRobotByName(robotName);

    if (!robot) {
      return null;
    }

    return {
      name: robot.name,
      version: robot.getVersion(),
      class: robot.robotClass,
    };
  }

  /**
   * Example: Find robots by type
   */
  findChatRobots(): AbstractRobot[] {
    return this.robotService
      .getAllRobots()
      .filter((robot) => robot.robotClass.includes('Chat'));
  }

  /**
   * Example: Check if a robot exists before using it
   */
  async safeRobotOperation(robotName: string): Promise<boolean> {
    if (!this.robotService.hasRobot(robotName)) {
      console.log(`Robot '${robotName}' is not available`);
      return false;
    }

    const robot = this.robotService.getRobotByName(robotName);
    console.log(`Found robot: ${robot!.name} v${robot!.getVersion()}`);
    return true;
  }
}

/**
 * Example usage in a controller or another service
 */
export class ExampleUsageScenarios {
  constructor(private readonly robotService: RobotService) {}

  async demonstrateUsage() {
    // 1. Get robot by name
    const chatRobot = this.robotService.getRobotByName('ChatRobotParrot');
    if (chatRobot) {
      console.log(`Found robot: ${chatRobot.name}`);
    }

    // 2. List all available robots
    const availableRobots = this.robotService.getAvailableRobotNames();
    console.log('Available robots:', availableRobots);

    // 3. Check if robot exists
    if (this.robotService.hasRobot('RobotChatOpenAI')) {
      console.log('OpenAI robot is available');
    }

    // 4. Get robots by class type
    const pseudoRobots =
      this.robotService.getRobotsByClass('PseudoRobotRouter');
    console.log(`Found ${pseudoRobots.length} pseudo router robots`);

    // 5. Get all robots and their info
    const allRobots = this.robotService.getAllRobots();
    allRobots.forEach((robot) => {
      console.log(
        `Robot: ${robot.name} v${robot.getVersion()} (${robot.robotClass})`,
      );
    });
  }
}
