import { test, expect } from '@playwright/test';

test.describe('Chat Streaming', () => {
  test('should display correct responses when multiple messages are sent', async ({ page }) => {
    // Navigate to the app with mock endpoints enabled
    await page.goto('/?debug=mock');

    // Wait for the chat interface to load
    await page.waitForSelector('mat-form-field input[matInput]');

    // Type the first question
    const input = page.locator('mat-form-field input[matInput]');
    await input.fill('Can I cancel anytime without financial penalty');
    await input.press('Enter');

    // Wait for the first response
    await page.waitForSelector('.message.assistant', { timeout: 10000 });

    // Get the first assistant message
    const firstAssistantMessage = page.locator('.message.assistant').first();
    await expect(firstAssistantMessage).toContainText('cancel anytime without financial penalty');

    // Now send a second question
    await input.fill('What kind of shoes can I wear?');
    await input.press('Enter');

    // Wait for the second response
    await page.waitForSelector('.message.assistant', { timeout: 10000 });

    // Check that we now have 2 user messages and 2 assistant messages
    const userMessages = page.locator('.message.user');
    const assistantMessages = page.locator('.message.assistant');

    await expect(userMessages).toHaveCount(2);
    await expect(assistantMessages).toHaveCount(2);

    // The second assistant message should be about shoes, not about cancellation
    const secondAssistantMessage = assistantMessages.nth(1);
    await expect(secondAssistantMessage).toContainText('shoes');
    await expect(secondAssistantMessage).not.toContainText('cancel');
  });

  test('should maintain message history correctly across streams', async ({ page }) => {
    await page.goto('/?debug=mock');

    // Wait for the chat interface to load
    await page.waitForSelector('mat-form-field input[matInput]');

    const input = page.locator('mat-form-field input[matInput]');

    // Send first message
    await input.fill('Hello');
    await input.press('Enter');

    // Wait for response
    await page.waitForSelector('.message.assistant', { timeout: 5000 });

    // Send second message
    await input.fill('How are you?');
    await input.press('Enter');

    // Wait for second response
    await page.waitForSelector('.message.assistant', { timeout: 5000 });

    // Verify we have the correct number of messages
    const userMessages = page.locator('.message.user');
    const assistantMessages = page.locator('.message.assistant');

    // Should have 2 user messages and 2 assistant messages
    await expect(userMessages).toHaveCount(2);
    await expect(assistantMessages).toHaveCount(2);

    // Verify the content of the messages
    await expect(userMessages.nth(0)).toContainText('Hello');
    await expect(userMessages.nth(1)).toContainText('How are you?');
  });
});
