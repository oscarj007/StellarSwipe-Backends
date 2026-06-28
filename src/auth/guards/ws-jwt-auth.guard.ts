import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import { SessionManagerService } from '../session/session-manager.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * WebSocket JWT guard (#646).
 * Validates the Bearer token supplied in the socket handshake:
 *   - auth.token  (socket.io auth object)
 *   - Authorization header (query / extra headers)
 *
 * Attach via @UseGuards(WsJwtAuthGuard) on a gateway method,
 * or call canActivate() manually in handleConnection().
 */
@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionManager: SessionManagerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient<Socket>();
    return this.validateSocket(client);
  }

  async validateSocket(client: Socket): Promise<boolean> {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`WS connection ${client.id} rejected: no token`);
      throw new UnauthorizedException('Missing authentication token');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });
    } catch {
      this.logger.warn(`WS connection ${client.id} rejected: invalid token`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Verify session is still active (respects logout / logout-all)
    if (payload.sid) {
      const session = await this.sessionManager.getSession(payload.sid);
      if (!session) {
        this.logger.warn(
          `WS connection ${client.id} rejected: session revoked`,
        );
        throw new UnauthorizedException('Session has been revoked');
      }
    }

    // Attach user info to the socket for downstream handlers
    (client as any).user = { id: payload.sub, sessionId: payload.sid };
    return true;
  }

  private extractToken(client: Socket): string | null {
    // 1) socket.io auth object  { auth: { token: 'Bearer <jwt>' } }
    const authObj = (client.handshake as any)?.auth?.token as
      | string
      | undefined;
    if (authObj) return authObj.replace(/^Bearer\s+/i, '');

    // 2) Authorization header
    const header = client.handshake.headers?.authorization as
      | string
      | undefined;
    if (header) return header.replace(/^Bearer\s+/i, '');

    return null;
  }
}
