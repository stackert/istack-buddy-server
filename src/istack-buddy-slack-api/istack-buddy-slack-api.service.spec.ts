import { Test, TestingModule } from '@nestjs/testing';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';
import { ConversationListServiceModule } from '../ConversationLists';
import { RobotModule } from '../robots/robot.module';

describe('IstackBuddySlackApiService', () => {
  let service: IstackBuddySlackApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConversationListServiceModule, RobotModule],
      providers: [IstackBuddySlackApiService],
    }).compile();

    // Ensure module initialization is complete
    await module.init();

    service = module.get<IstackBuddySlackApiService>(
      IstackBuddySlackApiService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should integrate with ConversationListService', () => {
    // Test that the service has access to the conversation service
    expect(service['conversationService']).toBeDefined();
  });

  describe('handleSlackEvent', () => {
    let mockResponse: any;

    beforeEach(() => {
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should handle URL verification challenge', async () => {
      const mockRequest = {
        body: {
          type: 'url_verification',
          challenge: 'test-challenge-123',
        },
      };

      await service.handleSlackEvent(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        challenge: 'test-challenge-123',
      });
    });

    it('should handle event callback with app mention', async () => {
      // Mock fetch globally
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      });

      const mockRequest = {
        body: {
          type: 'event_callback',
          event: {
            type: 'app_mention',
            user: 'U123456789',
            channel: 'C987654321',
            text: '<@UBOT123456> Hello there!',
            ts: '1234567890.123456',
          },
        },
      };

      // Get conversation service to verify conversation creation
      const conversationService = service['conversationService'];
      const initialConversationCount =
        conversationService.getConversationCount();

      await service.handleSlackEvent(mockRequest, mockResponse);

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ ok: true });

      // Verify conversation was created/updated
      const finalConversationCount = conversationService.getConversationCount();
      expect(finalConversationCount).toBeGreaterThanOrEqual(
        initialConversationCount,
      );

      // Verify conversation exists and has messages
      const conversationId = 'slack-channel-C987654321';
      const conversation =
        conversationService.getConversationById(conversationId);

      expect(conversation).toBeDefined();
      expect(conversation!.getMessageCount()).toBeGreaterThan(0);

      // Verify fetch was called to send response to Slack
      expect(global.fetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('C987654321'),
        }),
      );

      // Clean up
      (global.fetch as jest.Mock).mockRestore();
    });

    it('should handle network errors gracefully', async () => {
      // Mock fetch to throw an error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const mockRequest = {
        body: {
          type: 'event_callback',
          event: {
            type: 'app_mention',
            user: 'U123456789',
            channel: 'C987654321',
            text: '<@UBOT123456> Hello there!',
            ts: '1234567890.123456',
          },
        },
      };

      await service.handleSlackEvent(mockRequest, mockResponse);

      // Even with errors in handleAppMention, the main handler should return 200
      // to acknowledge receipt of the event (Slack requirement)
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ ok: true });

      // Clean up
      (global.fetch as jest.Mock).mockRestore();
    });

    it('should handle unknown event types gracefully', async () => {
      const mockRequest = {
        body: {
          type: 'event_callback',
          event: {
            type: 'unknown_event_type',
            // Unknown event type should be handled gracefully
          },
        },
      };

      await service.handleSlackEvent(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ ok: true });
    });
  });
});
