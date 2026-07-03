import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import type { ApiResponse, ChatRequestDto, ChatResponseDto } from '@dmtecha/shared-types';

import { CurrentUser } from '../auth/auth.decorator';
import type { AuthenticatedUser } from '../auth/auth.guard';
import { SupabaseAuthGuard } from '../auth/auth.guard';

import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChatRequestDto,
  ): Promise<ApiResponse<ChatResponseDto>> {
    const result = await this.chatService.chat(
      user.id,
      dto.message,
      dto.conversationId,
      user.accessToken,
    );
    return { success: true, data: result };
  }

  @Get('conversations')
  async getConversations(@CurrentUser() user: AuthenticatedUser): Promise<ApiResponse<unknown[]>> {
    const conversations = await this.chatService.getConversations(user.id);
    return { success: true, data: conversations };
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') conversationId: string,
  ): Promise<ApiResponse<unknown[]>> {
    const messages = await this.chatService.getMessages(conversationId, user.id);
    return { success: true, data: messages };
  }
}
