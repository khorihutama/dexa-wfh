import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  EVENTS,
  JwtPayloadDto,
  ProfileUpdatedEventDataDto,
  verifyJwtToken,
} from '@dexa-wfh/common';
import { loadEnvConfig, parseCorsOrigins } from '@dexa-wfh/config';

const gatewayConfig = loadEnvConfig();

@WebSocketGateway({
  cors: {
    origin: parseCorsOrigins(gatewayConfig.CORS_ORIGIN),
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly config = gatewayConfig;

  handleConnection(client: Socket) {
    const token = NotificationsGateway.extractToken(client);
    let user: JwtPayloadDto | null = null;

    if (token) {
      try {
        const payload = verifyJwtToken(token, this.config.JWT_SECRET);
        if (payload.role === 'ADMIN') {
          user = payload;
        }
      } catch {
        user = null;
      }
    }

    if (!user) {
      client.emit(EVENTS.ADMIN_NOTIFICATION, {
        id: `auth-${Date.now()}`,
        type: 'error',
        title: 'Unauthorized',
        message: 'Koneksi real-time memerlukan token Admin HRD yang sah.',
        timestamp: new Date().toISOString(),
      });
      client.disconnect(true);
      return;
    }

    client.data.user = user;
    client.emit(EVENTS.ADMIN_NOTIFICATION, {
      id: `conn-${Date.now()}`,
      type: 'info',
      title: 'Real-Time Channel Connected',
      message: `Connected to Dexa WFH API Gateway via Socket.IO as ${user.email}.`,
      timestamp: new Date().toISOString(),
    });
  }

  private static extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.trim().toLowerCase().startsWith('bearer ')) {
      return header.trim().slice(7).trim();
    }
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.trim();
    }
    return null;
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() payload: Record<string, unknown>) {
    const user = client.data?.user as JwtPayloadDto | undefined;
    if (!user || user.role !== 'ADMIN') {
      throw new WsException('Ping broadcast requires an authenticated Admin HRD session');
    }

    const notification = {
      id: `ping-${Date.now()}`,
      type: 'success',
      title: 'Admin Ping Broadcast',
      message:
        typeof payload?.message === 'string'
          ? payload.message
          : 'Sample real-time toast notification from API Gateway',
      timestamp: new Date().toISOString(),
    };
    this.server.emit(EVENTS.ADMIN_NOTIFICATION, notification);
    return notification;
  }

  broadcastNotification(title: string, message: string, extra?: Record<string, unknown>) {
    if (!this.server) return;
    this.server.emit(EVENTS.ADMIN_NOTIFICATION, {
      id: `evt-${Date.now()}`,
      type: 'info',
      title,
      message,
      timestamp: new Date().toISOString(),
      ...(extra ?? {}),
    });
  }

  broadcastProfileUpdated(data: ProfileUpdatedEventDataDto) {
    const notification = {
      id: `prof-${Date.now()}`,
      type: 'info',
      event: EVENTS.PROFILE_UPDATED,
      title: 'Employee Profile Updated',
      message:
        data.summary ||
        `${data.name} (${data.email}) updated profile: ${(data.changedFields ?? []).join(', ')}`,
      employeeId: data.employeeId,
      email: data.email,
      name: data.name,
      changedFields: data.changedFields ?? [],
      changes: data.changes ?? {},
      timestamp: data.timestamp || new Date().toISOString(),
    };
    if (this.server) {
      this.server.emit(EVENTS.ADMIN_NOTIFICATION, notification);
    }
    return notification;
  }
}
