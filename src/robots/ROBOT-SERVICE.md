# Robot Service

The `RobotService` is an injectable NestJS service that provides centralized access to all robot instances in the application. It allows client code to easily retrieve and manage robots by name.

## Installation

1. Import the `RobotModule` into your application module:

```typescript
import { Module } from '@nestjs/common';
import { RobotModule } from './robots/robot.module';

@Module({
  imports: [RobotModule],
  // ... other module configuration
})
export class AppModule {}
```

2. Inject the `RobotService` into your services or controllers:

```typescript
import { Injectable } from '@nestjs/common';
import { RobotService } from './robots/robot.service';

@Injectable()
export class YourService {
  constructor(private readonly robotService: RobotService) {}

  // Your service methods here
}
```

## Basic Usage

### Get a Robot by Name

```typescript
const robot = this.robotService.getRobotByName('ChatRobotParrot');
if (robot) {
  console.log(`Found robot: ${robot.name}`);
  // Use the robot...
}

// Get a Slack agent - the name matches the constructor name
const slackAgent = this.robotService.getRobotByName<SlackAgentCoreFormsParrot>(
  'SlackAgentCoreFormsParrot',
);
if (slackAgent) {
  console.log(`Found Slack agent: ${slackAgent.name}`);
  // slackAgent.name === slackAgent.constructor.name === 'SlackAgentCoreFormsParrot'
}
```

### Check if Robot Exists

```typescript
if (this.robotService.hasRobot('RobotChatOpenAI')) {
  // Robot exists, safe to use
  const robot = this.robotService.getRobotByName('RobotChatOpenAI');
}
```

### List Available Robots

```typescript
const availableRobots = this.robotService.getAvailableRobotNames();
console.log('Available robots:', availableRobots);
// Output: ['ChatRobotParrot', 'AgentRobotParrot', 'RobotChatOpenAI', ...]
```

### Get All Robot Instances

```typescript
const allRobots = this.robotService.getAllRobots();
allRobots.forEach((robot) => {
  console.log(`${robot.name} v${robot.getVersion()}`);
});
```

### Filter Robots by Class

```typescript
const chatRobots = this.robotService.getRobotsByClass('ChatRobotParrot');
console.log(`Found ${chatRobots.length} chat robots`);
```

## Advanced Usage

### Register Custom Robots

```typescript
// Create a custom robot instance
const customRobot = new YourCustomRobot();

// Register it with the service
this.robotService.registerRobot(customRobot);

// Now it's available via getRobotByName
const retrieved = this.robotService.getRobotByName(customRobot.name);
```

### Unregister Robots

```typescript
const wasRemoved = this.robotService.unregisterRobot('SomeRobotName');
if (wasRemoved) {
  console.log('Robot was successfully removed');
}
```

## Available Methods

| Method                                | Description                            | Return Type                  |
| ------------------------------------- | -------------------------------------- | ---------------------------- |
| `getRobotByName(name: string)`        | Get a robot instance by its name       | `AbstractRobot \| undefined` |
| `getAvailableRobotNames()`            | Get list of all registered robot names | `string[]`                   |
| `getAllRobots()`                      | Get all registered robot instances     | `AbstractRobot[]`            |
| `hasRobot(name: string)`              | Check if a robot exists                | `boolean`                    |
| `getRobotsByClass(className: string)` | Get robots filtered by class name      | `AbstractRobot[]`            |
| `registerRobot(robot, overwrite?)`    | Register a new robot instance          | `void`                       |
| `unregisterRobot(name: string)`       | Remove a robot by name                 | `boolean`                    |

## Built-in Robots

The service automatically registers the following robots on startup:

- `ChatRobotParrot` - A simple chat robot that parrots messages
- `AgentRobotParrot` - An agent robot that parrots messages
- `RobotChatOpenAI` - OpenAI chat robot
- `RobotChatAnthropic` - Anthropic chat robot
- `PseudoRobotRouter` - Pseudo robot for routing
- `PseudoRobotRouterSuggestions` - Pseudo robot for routing suggestions
- `PseudoRobotDocumentationSuggestions` - Pseudo robot for documentation suggestions
- `SlackAgentCoreFormsParrot` - Slack agent for core forms processing
- `SlackAgentCoreFormsSsoAutofillParrot` - Slack agent for SSO autofill forms processing

## Example: Sending Messages to Robots

```typescript
@Injectable()
export class ChatService {
  constructor(private readonly robotService: RobotService) {}

  async sendMessage(robotName: string, message: string) {
    const robot = this.robotService.getRobotByName(robotName);

    if (!robot) {
      throw new Error(`Robot '${robotName}' not found`);
    }

    const messageEnvelope = {
      routerId: 'chat-service',
      messageType: 'message' as const,
      message: {
        message,
        sender: 'user',
        timestamp: new Date().toISOString(),
      },
    };

    const response = await robot.acceptMessageMultiPartResponse(
      messageEnvelope,
      (delayedResponse) => {
        console.log('Delayed response:', delayedResponse);
      },
    );

    return response;
  }
}
```

## Error Handling

The service includes built-in error handling:

- `getRobotByName()` returns `undefined` if robot not found
- `registerRobot()` throws an error if robot name already exists (unless `overwrite` is true)
- `unregisterRobot()` returns `false` if robot doesn't exist

Always check for `undefined` when using `getRobotByName()`:

```typescript
const robot = this.robotService.getRobotByName('SomeRobot');
if (!robot) {
  // Handle robot not found
  console.error('Robot not found');
  return;
}

// Safe to use robot here
const response = await robot.acceptMessageMultiPartResponse(/* ... */);
```
