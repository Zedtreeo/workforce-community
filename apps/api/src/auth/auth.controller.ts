import { All, Controller, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { auth } from './auth.config';
import { toNodeHandler } from 'better-auth/node';

const handler = toNodeHandler(auth);

@Controller('auth')
export class AuthController {
  @All('*path')
  async handleAuth(@Req() req: Request, @Res() res: Response) {
    // Better-Auth handles all /api/v1/auth/* routes
    return handler(req, res);
  }
}
