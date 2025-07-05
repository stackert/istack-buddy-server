import { AbstractRobot } from './AbstractRobot';
import { TMessageEnvelope, TRobotMessage } from './types';

/**
 * A pseudo robot that provides documentation suggestions and helpful links
 * related to the iStack platform and robot ecosystem
 */
export class PseudoRobotDocumentationSuggestions extends AbstractRobot {
  public readonly name: string = 'PseudoRobotDocumentationSuggestions';
  public readonly version: string = '1.0.0';
  public readonly LLModelName: string = 'pseudo-documentation';
  public readonly LLModelVersion: string = '1.0.0';
  public readonly contextWindowSizeInTokens: number = 4096;

  static descriptionShort = `
    A pseudo robot that provides relevant documentation links and resources.
    Returns curated documentation suggestions based on message context and user needs.
  `;

  static descriptionLong = `
    PseudoRobotDocumentationSuggestions is a specialized pseudo robot focused on providing
    intelligent documentation recommendations and helpful resource links to users.
    
    This robot excels at:
    - Analyzing user queries to understand their documentation needs
    - Providing relevant links to platform documentation and guides
    - Suggesting contextual resources based on the current task or topic
    - Organizing documentation links by priority and relevance
    - Maintaining an up-to-date knowledge base of available resources
    
    Key features:
    - Contextual documentation analysis and suggestion
    - Multi-part response delivery for comprehensive resource lists
    - Categorized link organization (tutorials, API docs, examples, etc.)
    - Priority-based resource recommendation
    - Integration with the broader iStack documentation ecosystem
    
    In this pseudo implementation, it returns predefined iStack documentation links to
    demonstrate the suggestion mechanism. A full implementation would dynamically analyze
    user context and provide personalized documentation recommendations.
  `;

  private readonly documentationLinks = [
    {
      title: 'iStack Pseudo Documentation - Introduction',
      url: 'https://example.com/istack-pseudo/document-one.html',
      category: 'Getting Started',
      description: 'Overview of the iStack platform and basic concepts',
    },
    {
      title: 'iStack Pseudo Documentation - Robot Development Guide',
      url: 'https://example.com/istack-pseudo/document-two.html',
      category: 'Development',
      description: 'Comprehensive guide to developing and deploying robots',
    },
    {
      title: 'iStack Pseudo Documentation - API Reference',
      url: 'https://example.com/istack-pseudo/document-three.html',
      category: 'Reference',
      description: 'Complete API documentation and integration examples',
    },
    {
      title: 'iStack Pseudo Documentation - Best Practices',
      url: 'https://example.com/istack-pseudo/best-practices.html',
      category: 'Best Practices',
      description: 'Recommended patterns and practices for robot development',
    },
    {
      title: 'iStack Pseudo Documentation - Troubleshooting Guide',
      url: 'https://example.com/istack-pseudo/troubleshooting.html',
      category: 'Support',
      description: 'Common issues and solutions for robot deployment',
    },
  ];

  public estimateTokens(message: string): number {
    // Simple token estimation: roughly 4 characters per token
    return Math.ceil(message.length / 4);
  }

  public async acceptMessageMultiPartResponse(
    messageEnvelope: TMessageEnvelope,
    delayedMessageCallback: (response: TMessageEnvelope) => void,
  ): Promise<TMessageEnvelope> {
    const recvMessage: TRobotMessage = messageEnvelope.message || {};
    const incomingMessage = recvMessage.message || recvMessage.content || '';

    // Immediate response - analysis and preparation
    const analysisResponse: TRobotMessage = {
      role: 'assistant',
      content: `Analyzing documentation needs for: "${incomingMessage}"

PseudoRobotDocumentationSuggestions is searching the knowledge base for relevant resources...

Preparing personalized documentation recommendations...`,
      message: `Analyzing documentation needs and preparing suggestions...`,
      sender: this.name,
      receiver: recvMessage.sender || 'user',
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const immediateResponse: TMessageEnvelope = {
      ...messageEnvelope,
      messageType: 'response',
      message: analysisResponse,
    };

    // Delayed response with documentation suggestions
    setTimeout(() => {
      const documentationResponse =
        this.formatDocumentationResponse(incomingMessage);

      const suggestionsResponse: TRobotMessage = {
        role: 'assistant',
        content: documentationResponse,
        message: `Found ${this.documentationLinks.length} relevant documentation resources`,
        sender: this.name,
        receiver: recvMessage.sender || 'user',
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const delayedResponse: TMessageEnvelope = {
        ...messageEnvelope,
        messageType: 'response',
        message: suggestionsResponse,
      };

      if (
        delayedMessageCallback &&
        typeof delayedMessageCallback === 'function'
      ) {
        try {
          delayedMessageCallback(delayedResponse);
        } catch (error) {
          // Continue execution even if callback throws an error
        }
      }
    }, 1200);

    // Additional delayed response with categorized resources
    setTimeout(() => {
      const categorizedResponse = this.formatCategorizedResponse();

      const additionalResponse: TRobotMessage = {
        role: 'assistant',
        content: categorizedResponse,
        message: `Additional categorized documentation resources available`,
        sender: this.name,
        receiver: recvMessage.sender || 'user',
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const additionalEnvelope: TMessageEnvelope = {
        ...messageEnvelope,
        messageType: 'response',
        message: additionalResponse,
      };

      if (
        delayedMessageCallback &&
        typeof delayedMessageCallback === 'function'
      ) {
        try {
          delayedMessageCallback(additionalEnvelope);
        } catch (error) {
          // Continue execution even if callback throws an error
        }
      }
    }, 2500);

    return Promise.resolve(immediateResponse);
  }

  private formatDocumentationResponse(query: string): string {
    const linkList = this.documentationLinks
      .map(
        (link, index) => `${index + 1}. **${link.title}**
   ${link.url}
   📖 ${link.description}`,
      )
      .join('\n\n');

    return `## 📚 Documentation Suggestions

Based on your query: "${query}"

Here are the recommended documentation resources:

${linkList}

---
💡 **Quick Access Links:**
${this.documentationLinks.map((link) => `• [${link.title}](${link.url})`).join('\n')}

These resources should help you get started with the iStack platform and robot development!`;
  }

  private formatCategorizedResponse(): string {
    const categories = Array.from(
      new Set(this.documentationLinks.map((link) => link.category)),
    );

    const categorizedContent = categories
      .map((category) => {
        const categoryLinks = this.documentationLinks.filter(
          (link) => link.category === category,
        );
        const linkList = categoryLinks
          .map(
            (link) => `  • [${link.title}](${link.url}) - ${link.description}`,
          )
          .join('\n');

        return `### ${category}
${linkList}`;
      })
      .join('\n\n');

    return `## 📂 Documentation Categories

${categorizedContent}

---
🔗 **All Links Summary:**
${this.documentationLinks.map((link) => link.url).join('\n')}

Need help with something specific? Feel free to ask for more targeted documentation!`;
  }
}
