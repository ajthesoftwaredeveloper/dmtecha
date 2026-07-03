import { Body, Controller, Get, Param, Post, Delete, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import type { ApiResponse, ChatRequestDto, ChatResponseDto, UsageMetricsDto } from '@dmtecha/shared-types';

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

  @Post('stream')
  async chatStream(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChatRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await this.chatService.chatStream(
      user.id,
      dto.message,
      res,
      dto.conversationId,
    );
  }

  @Get('usage')
  async getUsageMetrics(@CurrentUser() user: AuthenticatedUser): Promise<ApiResponse<UsageMetricsDto>> {
    const metrics = await this.chatService.getUsageMetrics(user.id);
    return { success: true, data: metrics };
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

  @Delete('conversations/:id')
  async deleteConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') conversationId: string,
  ): Promise<ApiResponse<null>> {
    await this.chatService.deleteConversation(conversationId, user.id);
    return { success: true, data: null };
  }
}
