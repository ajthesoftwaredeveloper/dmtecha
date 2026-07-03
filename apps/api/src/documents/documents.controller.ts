import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import type {
  ApiResponse,
  CreateDocumentDto,
  Document,
  PaginatedResponse,
  UpdateDocumentDto,
} from '@dmtecha/shared-types';

import { CurrentUser } from '../auth/auth.decorator';
import type { AuthenticatedUser } from '../auth/auth.guard';
import { SupabaseAuthGuard } from '../auth/auth.guard';

import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(SupabaseAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDocumentDto,
  ): Promise<ApiResponse<Document>> {
    const doc = await this.documentsService.create(user.id, dto, user.accessToken);
    return { success: true, data: doc };
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('tag') tag?: string,
  ): Promise<ApiResponse<PaginatedResponse<Document>>> {
    const result = await this.documentsService.findAll(
      user.id,
      user.accessToken,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      tag,
    );
    return { success: true, data: result };
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ApiResponse<Document>> {
    const doc = await this.documentsService.findOne(user.id, id, user.accessToken);
    return { success: true, data: doc };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<ApiResponse<Document>> {
    const doc = await this.documentsService.update(user.id, id, dto, user.accessToken);
    return { success: true, data: doc };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ApiResponse<null>> {
    await this.documentsService.remove(user.id, id, user.accessToken);
    return { success: true, data: null };
  }
}
